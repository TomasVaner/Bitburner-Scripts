export async function main(ns: NS) {
  const board = ns.go.getBoardState();
  ns.clearLog();
  const size = board.length;

  for (let y = size - 1; y >= 0; --y) {
    let row = '';
    for (let x = 0; x < size; ++x) {
      row += board[x][y];
    }
    ns.print(row);
  }
  ns.print('----------');
  const chains = ns.go.analysis.getChains();
  for (let y = size - 1; y >= 0; --y) {
    let row = '';
    for (let x = 0; x < size; ++x) {
      row += (chains[x][y] ?? ' ---').toString().padStart(4);
    }
    ns.print(row);
  }
}
