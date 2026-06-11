import { GoOpponent } from '@ns';
import { ConvertToFlagsData } from '@/utility/flags';
import '@/utility/extensions/array';

type Coords = { x: number; y: number };
type TileType = 'X' | 'O' | '.' | '#';
type Control = 'X' | 'O' | '?' | '.';

type Neighbors = {
  enemies: Tile[];
  friends: Tile[];
  clear: Tile[];
  borders: Coords[];
  all: Tile[];
  chains: {
    friends: Chain[];
    enemies: Chain[];
    clear: Chain[];
    all: Chain[];
  };
};

type Tile = {
  point: Coords;
  tile: TileType;
  control: Control;
  valid_move: boolean;
  neighbors: Neighbors;
  chain: Chain;
  source: string;
};

type Chain = {
  id: number;
  points: Coords[];
  liberties: Tile[];
  tile: TileType;
  control: Control;
};

const flags_struct = {
  opponent: undefined as GoOpponent | undefined,
  size: 5 as 5 | 7 | 9 | 13,
  debug: false,
};

const flags_data = ConvertToFlagsData(flags_struct);
const opponents: GoOpponent[] = [
  'Netburners',
  'Slum Snakes',
  'The Black Hand',
  'Tetrads',
  'Daedalus',
  'Illuminati',
  'No AI',
];

const power_bonus: { [key: string]: number } = {
  Netburners: 1.3,
  'Slum Snakes': 1.2,
  'The Black Hand': 0.9,
  Tetrads: 0.7,
  Daedalus: 1.1,
  Illuminati: 0.7,
};

export async function main(ns: NS) {
  ns.disableLog('sleep');
  ns.disableLog('asleep');
  ns.disableLog('go.makeMove');
  ns.disableLog('go.passTurn');
  ns.disableLog('go.opponentNextTurn');
  ns.disableLog('go.resetBoardState');
  ns.clearLog();

  const flag = ns.flags(flags_data) as typeof flags_struct;
  const script_start_ts = performance.now();
  let total_points = 0;

  debugger;

  function getNextOpponent() {
    const opp_bon = opponents
      .filter((o) => o != 'No AI')
      .map((o) => {
        return {
          faction: o,
          bonus_base: (ns.go.analysis.getStats()[o]?.bonusPercent ?? 0) / power_bonus[o],
          bonus: ns.go.analysis.getStats()[o]?.bonusPercent ?? 0,
        };
      });

    ns.print(
      opp_bon.reduce(
        (s, o) =>
          s +
          `${o.faction.padEnd('The Black Hand'.length)}\t${ns.format.percent(o.bonus / 100)}\t${ns.format.percent(
            o.bonus_base / 100,
          )}\n`,
        '',
      ),
    );

    let min_bonus = [Infinity, 'No AI'] as [number, GoOpponent];
    let max_bonus = [-Infinity, 'No AI'] as [number, GoOpponent];
    for (const o of opp_bon) {
      if (o.bonus_base < min_bonus[0]) min_bonus = [o.bonus_base, o.faction];
      if (o.bonus_base > max_bonus[0]) max_bonus = [o.bonus_base, o.faction];
    }
    if (min_bonus[0] > max_bonus[0] * 0.9) return ns.go.getOpponent();
    return min_bonus[1];
  }

  while (true) {
    await PlayAGame(ns);
    const state = ns.go.getGameState();
    const next_opponent = flag.opponent ?? getNextOpponent();
    ns.go.resetBoardState(next_opponent, flag.size);
    total_points += state.blackScore;
    ns.print(
      `Game finished. (${state.blackScore} : ${state.whiteScore}). Total score: ${total_points} (${ns.format.number(
        (total_points / (performance.now() - script_start_ts)) * 1000,
      )})`,
    );
  }

  async function PlayAGame(ns: NS) {
    let result;
    let opponent_turn: Awaited<ReturnType<typeof ns.go.opponentNextTurn>> | undefined = undefined;
    let final_type: string | undefined = undefined;
    do {
      if (ns.go.getCurrentPlayer() === 'Black') {
        const { tiles, chains } = ConvertTiles();
        const validMoves = tiles.flat().filter((t) => t.valid_move);

        const chosen_move =
          getCaptureMove(validMoves) ??
          getPreventMergeMove(validMoves) ??
          getWeakenMove(validMoves) ??
          getFirstMove(validMoves) ??
          getMergeMove(validMoves) ??
          getSplitEmptyMove(validMoves) ??
          getExpansionMove(validMoves) ??
          getRandomMove(validMoves);
        // TODO: more move options

        if ((opponent_turn?.type == 'pass' && chosen_move?.control == 'X') || chosen_move === undefined) {
          // Pass turn if no moves are found
          ns.print(`Pass`);
          result = await ns.go.passTurn();
        } else {
          // Play the selected move
          ns.print(`Move: ${chosen_move.source}: ${chosen_move.point.x} ${chosen_move.point.y}`);
          if (flag.debug) await ns.sleep(2000);
          result = await ns.go.makeMove(chosen_move.point.x, chosen_move.point.y);
        }
      }

      // Log opponent's next move, once it happens
      const sleep_promise = ns.asleep(5000);
      const opponent_turn_promise = ns.go.opponentNextTurn();
      const awaited_turn = await Promise.any([sleep_promise, opponent_turn_promise]);
      opponent_turn = awaited_turn === true ? undefined : awaited_turn;
      // Keep looping as long as the opponent is playing moves
      final_type = result?.type ?? opponent_turn?.type ?? 'gameOver';
    } while (final_type !== 'gameOver');
  }

  function ConvertTiles(board?: string[]) {
    const valid_move_board = ns.go.analysis.getValidMoves(board);
    const control_board = ns.go.analysis.getControlledEmptyNodes(board);
    const chains_board = ns.go.analysis.getChains(board);
    const liberties_board = ns.go.analysis.getLiberties(board);

    if (board === undefined) board = ns.go.getBoardState();
    const size = board.length;
    const chains = [] as Chain[];

    for (let x = 0; x < size; ++x)
      for (let y = 0; y < size; ++y) {
        if (chains_board[x][y] === null) continue;
        if (chains[chains_board[x][y] ?? -1] === undefined)
          chains[chains_board[x][y] ?? -1] = {
            id: chains_board[x][y] ?? -1,
            points: [],
            liberties: [],
            tile: board[x][y] as TileType,
            control: control_board[x][y] as Control,
          };
        chains[chains_board[x][y] ?? -1].points.push({ x, y });
      }

    const tiles = [] as Tile[][];

    for (let x = 0; x < size; ++x) {
      tiles[x] = [] as Tile[];
      for (let y = 0; y < size; ++y) {
        const t = {} as Tile;
        t.point = { x, y };
        t.tile = board[x][y] as TileType;
        t.control = control_board[x][y] as Control;
        t.valid_move = valid_move_board[x][y];
        if (chains_board[x][y] !== null) t.chain = chains[chains_board[x][y] ?? -1];
        tiles[x][y] = t;
      }
    }

    for (let x = 0; x < size; ++x) {
      for (let y = 0; y < size; ++y) {
        tiles[x][y].neighbors = GetNeighborsList(tiles, { x, y });
      }
    }

    for (const chain of chains) {
      if (liberties_board[chain.points[0].x][chain.points[0].y] > 0) {
        for (const point of chain.points) {
          const t = tiles[point.x][point.y];
          for (const free_point of t.neighbors.clear) {
            if (!chain.liberties.some((l) => l.point.x == free_point.point.x && l.point.y == free_point.point.y)) {
              chain.liberties.push(free_point);
            }
          }
        }
      }
    }
    return { tiles, chains };
  }

  function GetNeighborsList(tiles: Tile[][], point: Coords) {
    const neighbors: Neighbors = {
      enemies: [] as Tile[],
      friends: [] as Tile[],
      clear: [] as Tile[],
      borders: [] as Coords[],
      all: [] as Tile[],
      chains: {
        friends: [] as Chain[],
        enemies: [] as Chain[],
        clear: [] as Chain[],
        all: [] as Chain[],
      },
    };

    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ]) {
      const neighbor_tile = tiles[point.x + dx]?.[point.y + dy];
      const tile_type = neighbor_tile?.tile ?? '#';
      const coords = { x: point.x + dx, y: point.y + dy };
      switch (tile_type) {
        case 'X':
          neighbors.friends.push(neighbor_tile);
          break;
        case 'O':
          neighbors.enemies.push(neighbor_tile);
          break;
        case '.':
          neighbors.clear.push(neighbor_tile);
          break;
        case '#':
          neighbors.borders.push(coords);
          break;
        default:
          throw `Unknown tile type `;
      }
      if (tile_type != '#') neighbors.all.push(neighbor_tile);
      if (neighbor_tile !== undefined && tile_type != '#') {
        if (!neighbors.chains.all.some((ch) => ch.id == neighbor_tile.chain.id)) {
          neighbors.chains.all.push(neighbor_tile.chain);
          switch (tile_type) {
            case 'X':
              neighbors.chains.friends.push(neighbor_tile.chain);
              break;
            case 'O':
              neighbors.chains.enemies.push(neighbor_tile.chain);
              break;
            case '.':
              neighbors.chains.clear.push(neighbor_tile.chain);
              break;
          }
        }
      }
    }

    return neighbors;
  }

  function GetRandomMoveOption(list: Tile[], source: string, color?: string) {
    const randomIndex = Math.floor(Math.random() * list.length);
    const move = list.at(randomIndex);

    if (color) {
      for (const move of list) {
        ns.go.analysis.highlightPoint(move.point.x, move.point.y, color, source);
      }
    }

    if (move !== undefined) {
      move.source = source;
    }
    return move;
  }

  function getRandomMove(validMoves: Tile[]) {
    let moveOptions = validMoves
      .filter((t) => t.point.x % 2 == 0 || t.point.y % 2 == 0)
      .filter((t) => t.control == '?');

    moveOptions = moveOptions.sort((m1, m2) => {
      return m2.neighbors.clear.length - m1.neighbors.clear.length;
    });
    moveOptions = moveOptions.filter((m) => m.neighbors.clear == moveOptions[0].neighbors.clear);

    return GetRandomMoveOption(moveOptions, 'Random');
  }

  function getExpansionMove(validMoves: Tile[]) {
    let moveOptions = validMoves.filter((m) => m.neighbors.friends.length > 0);

    moveOptions = moveOptions.filter((t) => t.point.x % 2 == 0 || t.point.y % 2 == 0);
    moveOptions = moveOptions.filter((t) => t.control == '?');
    moveOptions = moveOptions.filter(
      (t) =>
        (t.neighbors.clear.length > 0 || t.neighbors.chains.friends.sum((fc) => fc.liberties.length - 1) > 1) &&
        t.neighbors.clear.some((e) => e.chain.points.length > 1),
    );

    moveOptions = moveOptions.sort((m1, m2) => m2.neighbors.clear.length - m1.neighbors.clear.length);
    moveOptions = moveOptions.filter((m) => m.neighbors.clear == moveOptions[0].neighbors.clear);

    moveOptions = moveOptions.sort((m1, m2) => m2.chain.points.length - m1.chain.points.length);
    moveOptions = moveOptions.filter((m) => m.chain.points.length == moveOptions[0].chain.points.length);

    return GetRandomMoveOption(moveOptions, 'Expansion', 'DarkGreen');
  }

  function getCaptureMove(validMoves: Tile[]) {
    let moveOptions = validMoves.filter((m) => m.neighbors.enemies.length > 0);

    moveOptions = moveOptions.filter((m) => m.neighbors.enemies.some((e) => e.chain.liberties.length == 1));
    moveOptions = moveOptions.filter(
      (m) =>
        m.neighbors.clear.length > 0 ||
        m.neighbors.friends.some((f) => f.chain.liberties.length > 2) ||
        m.neighbors.enemies.length + m.neighbors.borders.length == 4,
    );

    return GetRandomMoveOption(moveOptions, 'Capture', 'Red');
  }

  function getWeakenMove(validMoves: Tile[]) {
    let moveOptions = validMoves
      .filter((m) => m.neighbors.enemies.length > 0)
      .map((m) => {
        return { ...m, enemyChains: [] as number[] };
      });

    moveOptions = moveOptions.filter((m) => m.neighbors.enemies.some((e) => e.chain.liberties.length == 2));

    moveOptions = moveOptions
      .filter((m) => m.neighbors.clear.length > 1 || m.neighbors.friends.some((f) => f.chain.liberties.length > 2))
      .map((m) => {
        m.neighbors.enemies.forEach((e) => {
          if (!m.enemyChains.includes(e.chain.id)) m.enemyChains.push(e.chain.id);
        });
        return m;
      })
      .sort((m1, m2) => m2.enemyChains.length - m1.enemyChains.length);

    moveOptions = moveOptions.filter((m) => m.enemyChains.length == moveOptions[0].enemyChains.length);

    moveOptions.sort((m1, m2) => m1.neighbors.friends.length - m2.neighbors.friends.length);
    moveOptions = moveOptions.filter((m) => m.neighbors.friends.length == moveOptions[0].neighbors.friends.length);

    return GetRandomMoveOption(moveOptions, 'Weaken', 'Yellow');
  }

  function getPreventMergeMove(validMoves: Tile[]) {
    const moveOptions = validMoves
      .filter((m) => m.neighbors.enemies.length > 1)
      .filter((m) => new Set(m.neighbors.enemies.map((e) => e.chain)).size > 1)
      .filter((m) => {
        let min_common_liberites = Infinity;
        for (const ch1 of m.neighbors.enemies.map((t) => t.chain)) {
          for (const ch2 of m.neighbors.enemies.map((t) => t.chain)) {
            if (ch1 === ch2) continue;
            let common_liberties = 0;
            for (const l of ch1.liberties) {
              if (ch2.liberties.includes(l)) {
                ++common_liberties;
              }
            }
            if (min_common_liberites > common_liberties) min_common_liberites = common_liberties;
          }
        }
        return min_common_liberites == 1;
      });

    return GetRandomMoveOption(moveOptions, 'Prevent Merge', 'Purple');
  }

  function getFirstMove(validMoves: Tile[]) {
    let moveOptions = validMoves.filter((t) => t.neighbors.clear.length > 1);
    moveOptions = moveOptions.filter((t) => t.neighbors.clear.some((e) => e.neighbors.borders.length == 3));
    moveOptions.sortby((m) => m.neighbors.clear.length, false);
    moveOptions.filter((m) => m.neighbors.clear.length == moveOptions[0].neighbors.clear.length);

    return GetRandomMoveOption(moveOptions, 'First', 'White');
  }

  function getMergeMove(validMoves: Tile[]) {
    let moveOptions = validMoves.filter((t) => t.neighbors.friends.length > 0);
    moveOptions = moveOptions.filter((t) => t.neighbors.chains.friends.length > 1);
    moveOptions = moveOptions.filter((t) => t.neighbors.chains.friends.some((f) => f.liberties.length > 1));
    moveOptions = moveOptions.filter(
      (t) =>
        t.neighbors.chains.friends.reduce((l, c) => {
          c.liberties.forEach((cl) => l.add(cl));
          return l;
        }, new Set<Tile>()).size > 3,
    );

    return GetRandomMoveOption(moveOptions, 'Merge', 'White');
  }

  function simulateTurn(point: Coords, turn = 'X', board?: string[]) {
    if (board === undefined) board = ns.go.getBoardState();
    const before = [...board.slice(0, point.x)];
    const after = [...board.slice(point.x + 1)];
    const target = board[point.x].slice(0, point.y) + turn + board[point.x].slice(point.y + 1);
    const next_board = [...before, target, ...after];
    return ConvertTiles(next_board);
  }

  function getSplitEmptyMove(validMoves: Tile[]) {
    let moveOptions = validMoves.filter((t) => t.control == '?');
    moveOptions = moveOptions.filter((t) => t.neighbors.friends.length > 1);
    moveOptions = moveOptions.filter((t) => t.neighbors.friends.length > 1);
    //moveOptions = moveOptions.filter((t) => t.neighbors.borders.length > 1);
    moveOptions = moveOptions.filter(
      (t) =>
        t.neighbors.chains.friends.reduce((l, c) => {
          c.liberties.forEach((cl) => l.add(cl));
          return l;
        }, new Set<Tile>()).size > 3,
    );
    moveOptions = moveOptions.filter((t) => {
      const simulated = simulateTurn(t.point).tiles;
      return simulated[t.point.x][t.point.y].neighbors.chains.clear.length > 1;
    });

    return GetRandomMoveOption(moveOptions, 'Split Empty', 'Orange');
  }
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
  if (args.at(-1) == '--opponent' || (args.at(-2) == '--opponent' && data.command.at(-1) != ' ')) {
    return opponents.map((o) => `"${o}"`);
  }

  if (args.at(-1) == '--size' || (args.at(-2) == '--size' && data.command.at(-1) != ' ')) {
    return [5, 7, 9, 13];
  }

  data.flags(flags_data);

  return ['--tail'];
}
