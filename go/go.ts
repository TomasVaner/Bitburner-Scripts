type Coords = {x:number, y:number};
type TileType = "X" | "O" | "." | "#"
type Control = "X" | "O" | "?" | "."
type Neighbors = {
    enemies : Tile[],
    friends : Tile[],
    empties : Tile[],
    borders : Coords[],
    chains : Chain[],
  };
type Tile = {
  point: Coords,
  tile: TileType,
  control: Control,
  valid_move: boolean,
  neighbors: Neighbors,
  chain: Chain,
  source:string
}

type Chain = {
  id: number,
  points: Coords[],
  liberties: Coords[],
  tile: TileType,
  control: Control
}

export async function main(ns: NS) {
  ns.disableLog('sleep');
  ns.disableLog('go.makeMove');
  ns.clearLog();

  await PlayAGame(ns);
}

export async function PlayAGame(ns:NS)
{
  let result;
  do {
    const board = ns.go.getBoardState();
    const {tiles, chains} = ConvertTiles(ns, board);

    const random_move = getRandomMove(tiles);
    const expansion_move = getExpansionMove(ns, tiles);
    const captureMove = getCaptureMove(ns, tiles);
    const weakenMove = getWeakenMove(ns, tiles);
    
    let chosen_move = captureMove ?? weakenMove ?? expansion_move ?? random_move;
    // TODO: more move options

    if (chosen_move === undefined) {
      // Pass turn if no moves are found
      result = await ns.go.passTurn();
    } else {
      // Play the selected move
      ns.print(`Move: ${(chosen_move.source)}: ${chosen_move.point.x} ${chosen_move.point.y}`);
      await ns.sleep(2000);
      result = await ns.go.makeMove(chosen_move.point.x, chosen_move.point.y);
    }

    // Log opponent's next move, once it happens
    await ns.go.opponentNextTurn();

    await ns.sleep(2000);

    // Keep looping as long as the opponent is playing moves
  } while (result?.type !== "gameOver");
}

function ConvertTiles(ns: NS, board?:string[])
{
  if (board === undefined)
    board = ns.go.getBoardState();
  const size = board.length;

  let control_board = ns.go.analysis.getControlledEmptyNodes(board);
  let chains_board = ns.go.analysis.getChains(board);
  let chains = [] as Chain[];

  for (let x = 0; x < size; ++x)
    for (let y = 0; y < size; ++y)
    {
      if (chains_board[x][y] === null)
        continue;
      if (chains[chains_board[x][y] ?? -1] === undefined)
        chains[chains_board[x][y] ?? -1] = {
          id: chains_board[x][y] ?? -1,
          points:[], 
          liberties:[], 
          tile:board[x][y] as TileType,
          control:control_board[x][y] as Control};
      chains[chains_board[x][y] ?? -1].points.push({x, y});
    }

  let valid_move_board = ns.go.analysis.getValidMoves(board);
  let tiles = [] as Tile[][];

  for (let x = 0; x < size; ++x)
  {
    tiles[x] = [] as Tile[];
    for (let y = 0; y < size; ++y)
    {
      let t = {} as Tile;
      t.point = {x, y};
      t.tile = board[x][y] as TileType;
      t.control = control_board[x][y] as Control;
      t.valid_move = valid_move_board[x][y];
      if (chains_board[x][y] !== null)
        t.chain = chains[chains_board[x][y] ?? -1]
      tiles[x][y] = t;
    }
  }

  for (let x = 0; x < size; ++x)
  {
    for (let y = 0; y < size; ++y) {
      tiles[x][y].neighbors = GetNeighborsList(tiles, {x,y});
    }
  }

  let liberties_board = ns.go.analysis.getLiberties(board);
  for (let chain of chains)
  {
    if (liberties_board[chain.points[0].x][chain.points[0].y] > 0)
    {
      for (let point of chain.points)
      {
        let t = tiles[point.x][point.y];
        for (let free_point of t.neighbors.empties)
        {
          if (!chain.liberties.some(l => l.x == free_point.point.x && l.y == free_point.point.y))
          {
            chain.liberties.push(free_point.point);
          }
        }
      }
    }
  }
  return {tiles, chains};
}

function GetNeighborsList(tiles:Tile[][], point:Coords)
{
  let neighbors = {
    enemies : [] as Tile[],
    friends : [] as Tile[],
    empties : [] as Tile[],
    borders : [] as Coords[],
    chains :  [] as Chain[]
    } ;

  for (let [dx, dy] of [[0, 1],[1,0], [0,-1], [-1,0]])
  {
    let neighbor_tile = tiles[point.x+dx]?.[point.y + dy];
    let tile_type = neighbor_tile?.tile ?? "#";
    let coords = {x:point.x+dx, y:point.y + dy}
    switch (tile_type)
    {
      case 'X': neighbors.friends.push(neighbor_tile); break;
      case 'O': neighbors.enemies.push(neighbor_tile); break;
      case '.': neighbors.empties.push(neighbor_tile); break;
      case '#': neighbors.borders.push(coords); break;
      default: throw `Unknown tile type `
    }

    if (!neighbors.chains.includes)
    {}
  }



  return neighbors;
}

function GetRandomElement<ArrayType>(list: ArrayType[])
{
  const randomIndex = Math.floor(Math.random() * list.length);
  return list[randomIndex];
}

const getRandomMove = (tiles:Tile[][]) => {
  let moveOptions = tiles.flat()
    .filter(t => t.valid_move)
    .filter(t => t.point.x % 2 == 0 || t.point.y % 2 == 0);

  moveOptions = moveOptions.sort((m1, m2) => {return m2.neighbors.empties.length - m1.neighbors.empties.length});
  moveOptions = moveOptions.filter(m => m.neighbors.empties == moveOptions[0].neighbors.empties)

  if (moveOptions.length == 0)
    return undefined;

  let move = GetRandomElement(moveOptions);
  if (move !== undefined) move.source = "Random"
  return move;
};

const getExpansionMove = (ns:NS, tiles:Tile[][]) => {
  let moveOptions = tiles.flat()
    .filter(t => t.valid_move)
    .filter(m => m.neighbors.friends.length > 0);

  moveOptions = moveOptions.filter(t => t.point.x % 2 == 0 || t.point.y % 2 == 0);
  moveOptions = moveOptions.filter(t => t.control == '?');

  moveOptions = moveOptions
    .sort((m1,m2) => m2.neighbors.empties.length - m1.neighbors.empties.length);
  moveOptions = moveOptions
    .filter(m => m.neighbors.empties == moveOptions[0].neighbors.empties)

  moveOptions = moveOptions
    .sort((m1,m2) => m2.chain.points.length - m1.chain.points.length);
  moveOptions = moveOptions
    .filter(m => m.chain.points.length == moveOptions[0].chain.points.length)

  for (let move of moveOptions)
  {
    ns.go.analysis.highlightPoint(move.point.x, move.point.y, "DarkGreen", "Expansion");
  }

  let move = GetRandomElement(moveOptions);
  if (move !== undefined) move.source = "Expansion"
  return move;
}

const getCaptureMove = (ns: NS, tiles:Tile[][]) => {
  let moveOptions = tiles.flat()
    .filter(t => t.valid_move)
    .filter(m => m.neighbors.enemies.length > 0);

  moveOptions = moveOptions
    .filter(m => m.neighbors.enemies.some(e => e.chain.liberties.length == 1));
  moveOptions = moveOptions
    .filter(m => 
      m.neighbors.empties.length > 0 
      || m.neighbors.friends.some(f => f.chain.liberties.length > 2)
      || m.neighbors.enemies.length + m.neighbors.borders.length == 4);

  for (let move of moveOptions)
  {
    ns.go.analysis.highlightPoint(move.point.x, move.point.y, "Red", "Capture");
  }

  let move = GetRandomElement(moveOptions);
  if (move !== undefined) move.source = "Capture"
  return move;
}

const getWeakenMove = (ns: NS, tiles:Tile[][]) => {
  let moveOptions = tiles.flat()
    .filter(t => t.valid_move)
    .filter(m => m.neighbors.enemies.length > 0)
    .map(m => {return {...m, enemyChains:[] as number[]}});

  moveOptions = moveOptions
    .filter(m => m.neighbors.enemies.some(e => e.chain.liberties.length == 2));

  moveOptions = moveOptions
    .filter(m => m.neighbors.empties.length > 1 ||  m.neighbors.friends.some(f => f.chain.liberties.length > 2))
    .map(m => 
    {
      m.neighbors.enemies.forEach(e => {
      if (!m.enemyChains.includes(e.chain.id)) 
        m.enemyChains.push(e.chain.id)
      });
      return m;
    })
    .sort((m1, m2) => m2.enemyChains.length - m1.enemyChains.length);

  moveOptions = moveOptions.filter(m => m.enemyChains.length == moveOptions[0].enemyChains.length);

  moveOptions.sort((m1, m2) => m1.neighbors.friends.length - m2.neighbors.friends.length);
  moveOptions = moveOptions.filter(m => m.neighbors.friends.length == moveOptions[0].neighbors.friends.length);

  for (let move of moveOptions)
  {
    ns.go.analysis.highlightPoint(move.point.x, move.point.y, "Yellow", "Weaken");
  }

  let move = GetRandomElement(moveOptions);
  if (move !== undefined) move.source = "Weaken"
  return move;
}

const getPreventMergeMove = (tiles:Tile[][]) =>
{
  let moveOptions = tiles.flat()
    .filter(t => t.valid_move)
    .filter(m => m.neighbors.enemies.length > 1)
    .map(m => {return {...m, enemyChains:[] as number[]}});

  
}