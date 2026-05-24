import { PortNumbers } from '@/utility/constants';
import { ContractSolveResultPacket } from '@/utility/network_packets';
import { NSLogger, Logger } from '@/utility/log';
import { ConvertToFlagsData, Contract, GetLastArgument } from '@/utility/flags';

const flags_struct: Contract.Solver.FileSolverArgs & Contract.Solver.TypeSolverArgs = {
  filename: '',
  hostname: 'home',
  type: '' as CodingContractName,
};
const flags_data = ConvertToFlagsData(flags_struct);

let primes = [2] as number[];
const known_partitions = [0, 1];
const known_ways: {
  [key: string]: number;
} = {};

const known_types: Partial<Record<CodingContractName, [boolean, (d: any, l: Logger) => any]>> = {
  'Subarray with Maximum Sum': [false, SubarrayWithMaximumSum],
  'Algorithmic Stock Trader I': [false, AlgorithmicStockTraderI],
  'Algorithmic Stock Trader II': [true, AlgorithmicStockTraderII],
  'Algorithmic Stock Trader III': [true, AlgorithmicStockTraderIII],
  'Algorithmic Stock Trader IV': [true, AlgorithmicStockTraderIV],
  'Find Largest Prime Factor': [false, FindLargestPrimeFactor],
  'Encryption I: Caesar Cipher': [false, EncryptionICaesarCipher],
  'Encryption II: Vigenère Cipher': [true, EncryptionIIVigenèreCipher],
  'Total Ways to Sum': [false, TotalWaysToSum],
  'Largest Rectangle in a Matrix': [true, LargestRectangleInAMatrix],
  'Array Jumping Game': [true, ArrayJumpingGame],
  'Total Number of Primes': [true, TotalNumberOfPrimes],
  'Square Root': [true, SquareRoot],
  'HammingCodes: Integer to Encoded Binary': [true, HammingCodesIntegerToEncodedBinary],
  'Compression I: RLE Compression': [true, CompressionIRLECompression],
  'Generate IP Addresses': [true, GenerateIPAddressesData],
  'Proper 2-Coloring of a Graph': [true, Proper2ColoringOfAGraph],
  'Unique Paths in a Grid II': [true, UniquePathInAGridII],
  'Spiralize Matrix': [true, SpiralizeMatrix],
  'Sanitize Parentheses in Expression': [true, SanitizeParenthesesInExpression],
  'Total Ways to Sum II': [true, TotalWaysToSumII],
  'Shortest Path in a Grid': [true, ShortestPathInAGrid],
  'Minimum Path Sum in a Triangle': [true, MinimumPathSumInATriangle],
  'Find All Valid Math Expressions': [true, FindAllValidMathExpressions],
};

export async function main(ns: NS) {
  ns.disableLog('scan');
  ns.clearLog();
  const flag = ns.flags(flags_data) as typeof flags_struct;

  let ctype = flag.type;

  if (ctype.length == 0) {
    if (flag.filename.length == 0) {
      ctype = Object.keys(known_types).at(-1) as CodingContractName;
    } else {
      ctype = ns.codingcontract.getContractType(flag.filename);
    }
  }

  if (!ctype?.length || !ns.codingcontract.getContractTypes().includes(ctype)) return;

  const logger = new NSLogger(ns, { extra_name: ctype.replaceAll(' ', '_') });

  logger.Log(`Running contract '${flag.filename}' with type: ${ctype}.`);
  logger.Log(`primes: ${primes.length}, ${primes.at(-1)}, known_partitions: ${known_partitions.length}`);

  let train = false;
  if (flag.filename.length == 0) {
    const contract = ns.codingcontract.createDummyContract(ctype, flag.hostname);
    if (contract == null) {
      logger.Log('ERROR: could not create contract');
      return;
    }
    flag.filename = contract;
    train = true;
  }

  const ktype = known_types[ctype];
  const return_obj = new ContractSolveResultPacket(ctype, flag.hostname, train ? '' : flag.filename, '', ns.pid);
  const contract_info = ns.codingcontract.getContract(flag.filename, flag.hostname);
  const data = ns.codingcontract.getData(flag.filename, flag.hostname);
  ns.atExit(() => {
    if (!return_obj.reward) {
      let data_str = '';
      try {
        data_str = JSON.stringify(data);
      } catch (_) {
        data_str = data.toString();
      }
      logger.Log(
        `ERROR: Failed to solve contract of type '${ctype}'. Data '${data_str}. Attempts left: ${
          contract_info.numTriesRemaining() - 1
        } (${flag.hostname}/${flag.filename})'.`,
        { global_log: true },
      );
    } else {
      logger.Log(
        `INFO: Succesfully solved contract of type ${ctype}.Reward: ${return_obj.reward} (${flag.hostname}/${flag.filename})`,
        { global_log: ktype ? ktype[0] : true },
      );
    }
    ns.writePort(PortNumbers.contract_scanner_in, JSON.stringify(return_obj));
  }, 'callback');

  if (ktype !== undefined) {
    logger.Log(`Trying to solve '${ctype}' contract`);

    const answer = ktype[1](data, logger);

    return_obj.reward = ns.codingcontract.attempt(answer, flag.filename, flag.hostname);

    if (!return_obj.reward) {
      throw `Could not solve contract ${flag.filename}/${flag.hostname}`;
    }
  } else {
    logger.Log(`Training '${ctype}' contract`);
    const data = ns.codingcontract.getData(flag.filename, flag.hostname);
    const contract_info = ns.codingcontract.getContract(flag.filename, flag.hostname);

    let data_str = '';
    try {
      data_str = JSON.stringify(data);
    } catch (_) {
      data_str = data.toString();
    }

    logger.Log(
      `Training contract '${contract_info.type}' with data ${data_str}. Description: ${contract_info.description}`,
    );
  }

  if (train) {
    ns.rm(flag.filename, flag.hostname);
  }
}
function SubarrayWithMaximumSum(data: number[], logger: Logger) {
  /*{"type":"Subarray with Maximum Sum",
    "data":[6,-1,0,6,6,10,-6,7,5,-8,-6,9,6,3,-1,-7,6,-3,6,7,-10,8],
    "description":"Given the following integer array, find the contiguous subarray 
    (containing at least one number) which has the largest sum and return that sum. 
    'Sum' refers to the sum of all the numbers in the subarray.
     6,-1,0,6,6,10,-6,7,5,-8,-6,9,6,3,-1,-7,6,-3,6,7,-10,8","difficulty":1}*/

  const sub_sums = [] as number[][];
  let max_sum = data[0];

  for (let ind_from = 0; ind_from < data.length; ++ind_from) {
    for (let ind_to = ind_from; ind_to < data.length; ++ind_to) {
      if (sub_sums[ind_from] == undefined) sub_sums[ind_from] = [];

      if (ind_to + ind_from == 0) {
        sub_sums[ind_from][ind_to] = data[0];
        continue;
      }

      if (ind_from > 0) {
        sub_sums[ind_from][ind_to] = sub_sums[ind_from - 1][ind_to] - data[ind_from - 1];
      } else {
        sub_sums[ind_from][ind_to] = sub_sums[ind_from][ind_to - 1] + data[ind_to];
      }
      if (max_sum < sub_sums[ind_from][ind_to]) max_sum = sub_sums[ind_from][ind_to];
    }
  }

  return max_sum;
}

function AlgorithmicStockTrader(count: number, prices: number[], known: Record<string, number>) {
  if (count == 0) return 0;
  const profit_key = `${count} - [${prices}]`;
  if (known[profit_key] != undefined) return known[profit_key];

  let max_profit = 0;

  for (let ind_buy = 0; ind_buy < prices.length; ++ind_buy) {
    for (let ind_sell = ind_buy + 1; ind_sell < prices.length; ++ind_sell) {
      const profit =
        prices[ind_sell] - prices[ind_buy] + AlgorithmicStockTrader(count - 1, prices.slice(ind_sell + 1), known);
      if (max_profit < profit) max_profit = profit;
    }
  }

  known[profit_key] = max_profit;
  return max_profit;
}

function AlgorithmicStockTraderI(data: number[], logger: Logger) {
  /*{ "type": "Algorithmic Stock Trader I", 
    "data": [133, 12, 166, 146, 106, 37, 82, 126, 89, 155, 123, 81, 122], 
    "description": "You are given the following array of stock prices (which are numbers) 
    where the i-th element represents the stock price on day i:
    133,12,166,146,106,37,82,126,89,155,123,81,122
    Determine the maximum possible profit you can earn using at most one transaction 
    (i.e. you can only buy and sell the stock once). If no profit can be made then the answer should be 0.
    Note that you have to buy the stock before you can sell it.", "difficulty": 1 }*/

  const ret = AlgorithmicStockTrader(1, data, {});
  logger.Log(`[${data}] -> ${ret}`);

  return ret;
}

export function AlgorithmicStockTraderII(data: number[], logger: Logger) {
  /*Training contract 'Algorithmic Stock Trader II'
  with data [107,65,27,94,167,81,28,91,85,141,181,61,124,25,121,156,184,30,50,174,138,129,132,35,164,13,62,137,90,140,92,96,70,83,32,21,176,187,52,187,30,85,153,174,106,81,86,176,54].
  Description: You are given the following array of stock prices (which are numbers) where the i-th element represents the stock price on day i:

 107,65,27,94,167,81,28,91,85,141,181,61,124,25,121,156,184,30,50,174,138,129,132,35,164,13,62,137,90,140,92,96,70,83,32,21,176,187,52,187,30,85,153,174,106,81,86,176,54

 Determine the maximum possible profit you can earn using as many transactions as you'd like. A transaction is defined as buying and then selling one share of the stock. Note that you cannot engage in multiple transactions at once. In other words, you must sell the stock before you buy it again.

 If no profit can be made, then the answer should be 0.*/

  const ret = AlgorithmicStockTrader(Infinity, data, {});
  logger.Log(`[${data}] -> ${ret}`);

  return ret;
}

function AlgorithmicStockTraderIII(data: number[], logger: Logger) {
  /* type: Algorithmic Stock Trader III data: [60,1,131,66,145,82,178,50,177,32,58,158,181,15,172,22,41,161,143,31,56,50,39,183,36,37,176,165],
  desc: You are given the following array of stock prices (which are numbers) where the i-th element represents the stock price on day i:

  60,1,131,66,145,82,178,50,177,32,58,158,181,15,172,22,41,161,143,31,56,50,39,183,36,37,176,165

  Determine the maximum possible profit you can earn using at most two transactions. A transaction is defined as buying and then selling one share of the stock. Note that you cannot engage in multiple transactions at once. In other words, you must sell the stock before you buy it again.

  If no profit can be made, then the answer should be 0., diff: 4*/

  const ret = AlgorithmicStockTrader(2, data, {});
  logger.Log(`[${data}] -> ${ret}`);

  return ret;
}

function AlgorithmicStockTraderIV([k, data]: [number, number[]], logger: Logger) {
  /*type: Algorithmic Stock Trader IV data: [4,[193,145,199,61,139,32,27,124,159,66,20,64,165,103,154,76,28,44,107,200]],
  desc: You are given the following array with two elements:

  [4, [193,145,199,61,139,32,27,124,159,66,20,64,165,103,154,76,28,44,107,200]]

  The first element is an integer k. The second element is an array of stock prices (which are numbers) where the i-th element represents the stock price on day i.

  Determine the maximum possible profit you can earn using at most k transactions. A transaction is defined as buying and then selling one share of the stock. Note that you cannot engage in multiple transactions at once. In other words, you must sell the stock before you can buy it again.

  If no profit can be made, then the answer should be 0., diff: 8*/

  const ret = AlgorithmicStockTrader(k, data, {});
  logger.Log(`${k}, [${data}] -> ${ret}`);

  return ret;
}

function CheckPrime(num: number) {
  const p_ind_sqrt = primes.findIndex((p) => p >= Math.sqrt(num));
  if (p_ind_sqrt == -1) throw `primes are not filled enough! Max prime: ${primes.at(-1)}, num: ${num}`;

  return !primes.slice(0, p_ind_sqrt + 1).some((p) => num % p == 0);
}

function FindLargestPrimeFactor(data: number, logger: Logger) {
  let max_prime = 1;
  const prime_divisors = [];

  const limit = Math.sqrt(data);
  const start_from = (primes.at(-1) ?? 1) + 1;
  let numbers_to_check = [] as number[];

  const check_prime = (div: number) => {
    numbers_to_check = numbers_to_check.filter((n) => n % div != 0);
    if (data % div == 0) {
      while (data % div == 0) {
        data /= div;
      }
      logger.Log(`Data after division by ${div}: ${data}`);
      return true;
    }
    return false;
  };

  for (const p of primes) {
    if (p > limit) break;
    if (check_prime(p)) {
      prime_divisors.push(p);
      max_prime = p;
    }
  }

  for (let div = start_from; div < limit && data > 1; ++div) {
    if (!CheckPrime(div)) continue;
    primes.push(div);

    if (check_prime(div)) {
      prime_divisors.push(div);
      max_prime = div;
    }
  }
  if (data > 1) max_prime = data;

  logger.Log(`${max_prime}, divisors: ${JSON.stringify(prime_divisors)}, last prime: ${primes.at(-1)}`);
  return max_prime;
}

function EncryptionICaesarCipher([text, shift]: [string, number], logger: Logger) {
  /*{"type":"Encryption I: Caesar Cipher",
    "data":["DEBUG FLASH LOGIN VIRUS MODEM",19],
    "description":"Caesar cipher is one of the simplest encryption technique. 
    It is a type of substitution cipher in which each letter in the plaintext  
    is replaced by a letter some fixed number of positions down the alphabet. 
    For example, with a left shift of 3, D would be replaced by A,  
    E would become B, and A would become X (because of rotation).
    You are given an array with two elements:
     [\"DEBUG FLASH LOGIN VIRUS MODEM\", 19]
     The first element is the plaintext, the second element is the left shift value.
      Return the ciphertext as uppercase string. Spaces remains the same.","difficulty":1}*/
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let cipher = '';

  for (let ind = 0; ind < text.length; ++ind) {
    const pos = alphabet.indexOf(text[ind]);
    if (pos == -1) {
      cipher += text[ind];
    } else {
      cipher += alphabet.at(pos - shift);
    }
  }

  logger.Log(`${text} -> ${cipher} (${shift})`);

  return cipher;
}

function EncryptionIIVigenèreCipher([text, key]: [string, string]) {
  /*'Encryption II: Vigenère Cipher' with data ["CLOUDDEBUGPRINTLINUXPOPUP","HARDWARE"]. Description: Vigenère cipher is a type of polyalphabetic substitution. It uses  the Vigenère square to encrypt and decrypt plaintext with a keyword.

   Vigenère square:
          A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
        +----------------------------------------------------
      A | A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
      B | B C D E F G H I J K L M N O P Q R S T U V W X Y Z A
      C | C D E F G H I J K L M N O P Q R S T U V W X Y Z A B
      D | D E F G H I J K L M N O P Q R S T U V W X Y Z A B C
      E | E F G H I J K L M N O P Q R S T U V W X Y Z A B C D
                 ...
      Y | Y Z A B C D E F G H I J K L M N O P Q R S T U V W X
      Z | Z A B C D E F G H I J K L M N O P Q R S T U V W X Y

  For encryption each letter of the plaintext is paired with the corresponding letter of a repeating keyword. For example, the plaintext DASHBOARD is encrypted with the keyword LINUX:
    Plaintext: DASHBOARD
    Keyword:   LINUXLINU
  So, the first letter D is paired with the first letter of the key L. Therefore, row D and column L of the  Vigenère square are used to get the first cipher letter O. This must be repeated for the whole ciphertext.

  You are given an array with two elements:
   ["CLOUDDEBUGPRINTLINUXPOPUP", "HARDWARE"]
  The first element is the plaintext, the second element is the keyword.

  Return the ciphertext as uppercase string.*/
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  let cipher_text = '';
  for (let ind = 0; ind < text.length; ind++) {
    const plaintext_index = alphabet.indexOf(text[ind]);
    const keyword_index = alphabet.indexOf(key[ind % key.length]);
    const cipher_index = (plaintext_index + keyword_index) % alphabet.length;
    cipher_text += alphabet[cipher_index];
  }
  return cipher_text;
}

function G(k: number) {
  return (k * (3 * k - 1)) / 2;
}

function Partitions(n: number): number {
  if (n == 0) return 1;
  if (n == 1) return 1;
  if (known_partitions[n] != undefined) return known_partitions[n];

  let sum = 0;
  let k = 1;

  // @ignore-infinite
  while (true) {
    const sign = k % 2 == 1 ? 1 : -1;
    const g = G(k);
    const g_ = G(-k);
    if (g > n && g_ > n) {
      known_partitions[n] = sum;
      return sum;
    }

    if (g <= n) sum += sign * Partitions(n - g);
    if (g_ <= n) sum += sign * Partitions(n - g_);

    ++k;
  }
}

function TotalWaysToSum(data: number, logger: Logger) {
  /*{"type":"Total Ways to Sum",
    "data":69,
    "description":
    "It is possible write four as a sum in exactly four different ways:
    3 + 1\n     2 + 2\n     2 + 1 + 1\n     1 + 1 + 1 + 1
    How many different distinct ways can the number 69 be written as a sum of at least two positive integers?
    ","difficulty":1}*/

  /*let test_partitions = [];
    for (let ind = 1; ind < 50; ++ind)
    {
      let parts = Partitions(ind);
      test_partitions.push(ind, parts);
      ns.print(`${ind}\t${parts}`)
    }*/
  const partitions = Partitions(data);

  logger.Log(`${data} -> ${partitions - 1}`);
  return partitions - 1;
}

function LargestRectangleInAMatrix(data: number[][], logger: Logger) {
  /*{ "type": "Largest Rectangle in a Matrix", 
    "data": [[0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0], [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0], [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1], [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], 
    "description": "You are given a binary matrix consisting only of 0s and 1s:
    [
      [0,0,0,0,0,1,0,0,0,1,0],
      [0,1,0,0,0,0,0,0,0,0,0],
      [0,0,0,1,0,0,0,1,1,1,0],
      [0,0,0,0,0,0,0,0,1,0,1],
      [0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,0,0,0,0,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0],
      [0,1,0,0,0,0,0,0,0,1,0],
      [1,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,0,0,0,0,0,0,1,1],
      [0,0,0,1,0,0,0,0,0,0,0],
      [1,0,0,0,0,0,0,0,0,0,0]
    ]
  
    Your task is to find the two corners of the largest rectangle ([[r1,c1],[r2,c2]]) that does not contain any 1s.
  
    Example 1:
    Data:
    [
      [1,0,0],
      [0,0,0]
    ]
  
    Answer:[[0,1],[1,2]]
  
    Example 2:
    Data:
    [
      [0,0,0,1],
      [0,0,0,0],
      [0,0,1,0],
      [0,0,0,1]
    ]
  
    Answer: [[0,0],[3,1]]
    ", "difficulty": 6 }*/

  const subsum = [] as number[][][];
  let max_streak = { h: 0, l: 0, rf: -1, rt: -1, cf: -1, ct: -1 };
  for (let row_f = 0; row_f < data.length; ++row_f) {
    subsum[row_f] = [] as number[][];
    for (let row_t = row_f; row_t < data.length; ++row_t) {
      subsum[row_f][row_t] = [] as number[];
      let max_local_streak = { l: 0, cf: -1, ct: -1 };
      let local_streak = { l: 0, cf: -1, ct: -1 };

      for (let col = 0; col < data[0].length; ++col) {
        subsum[row_f][row_t][col] = data[row_t][col];
        if (row_t > row_f) subsum[row_f][row_t][col] += subsum[row_f][row_t - 1][col];
        if (subsum[row_f][row_t][col] > 0) {
          local_streak = { l: 0, cf: -1, ct: -1 };
        } else {
          if (local_streak.l == 0) {
            local_streak.cf = col;
          }
          ++local_streak.l;
          local_streak.ct = col;
          if (local_streak.l > max_local_streak.l) {
            max_local_streak = { ...local_streak };
            if (max_local_streak.l * (row_t - row_f + 1) > max_streak.l * max_streak.h) {
              max_streak = { ...max_local_streak, h: row_t - row_f + 1, rf: row_f, rt: row_t };
            }
          }
        }
      }
    }
  }

  logger.Log(
    `${data.reduce((s, r) => s + '\n' + JSON.stringify(r), '')} -> ${JSON.stringify([
      [max_streak.rf, max_streak.cf],
      [max_streak.rt, max_streak.ct],
    ])}`,
  );

  return [
    [max_streak.rf, max_streak.cf],
    [max_streak.rt, max_streak.ct],
  ];
}

function ArrayJumpingGame(data: number[], logger: Logger) {
  /*{"type":"Array Jumping Game",
    "data":[7,0,1,0,6,10,10,0,0,0,6,0,10,4,0,0,10],
    "description":"You are given the following array of integers:
     7,0,1,0,6,10,10,0,0,0,6,0,10,4,0,0,10
      Each element in the array represents your MAXIMUM jump length at that position. 
      This means that if you are at position i and your maximum jump length is n,
       you can jump to any position from i to i+n. \n\nAssuming you are initially 
       positioned at the start of the array, determine whether you are able to reach the last index.
       Your answer should be submitted as 1 or 0, representing true and false respectively.","difficulty":2} */
  let max_distance = 0;
  for (let ind = 0; ind < data.length; ++ind) {
    if (ind > max_distance || max_distance > data.length) break;

    max_distance = Math.max(ind + data[ind], max_distance);
  }

  logger.Log(`Hopped to ${max_distance}/${data.length}: ${data}`);

  return max_distance >= data.length - 1 ? 1 : 0;
}

function TotalNumberOfPrimes([from, to]: [number, number], logger: Logger) {
  /*{"type":"Total Number of Primes",
    "data":[1203909,1547817],
    "description":"You are given two random non-negative integers: 1203909,1547817.
    The first will be up to 5000000, and the second will be at most 1000000 greater.
    Determine the amount of prime numbers between them (including the numbers given).
    Example:
    The range of [0,20] contains the primes [2,3,5,7,11,13,17,19], resulting in an answer of 8.",
    "difficulty":2}*/
  primes = [2];
  let prime_count = 0;
  let p_ind_f = primes.findIndex((p) => p >= from);
  let p_ind_t = primes.findIndex((p) => p > to);
  if (p_ind_t == -1) p_ind_t = primes.length;

  if (p_ind_f >= 0) prime_count += p_ind_t - p_ind_f;

  let start = primes.at(-1) ?? 2;
  start += start == 2 ? 1 : 2;

  for (let iter = start; iter <= to; iter += 2) {
    if (!CheckPrime(iter)) continue;

    primes.push(iter);
    ++p_ind_t;
    if (iter >= from) {
      if (prime_count == 0) p_ind_f = primes.length - 1;
      ++prime_count;
    }
  }

  logger.Log(
    `Counted ${prime_count}/${primes.length} - [${p_ind_f}, ${p_ind_t - 1}] - [${primes[p_ind_f]}, ${
      primes[p_ind_t - 1]
    }]: [${[from, to]}]`,
  );
  return prime_count;
}

function SquareRoot(num: bigint, logger: Logger) {
  logger.Log(`Number: ${num}`);

  function HeronMethod(n: bigint, estimate: bigint) {
    let i = 0;
    let x: bigint;
    let x_ = estimate;
    do {
      x = x_;
      x_ = (x + n / x) / 2n;

      ++i;
      const diff = Number(x - x_);
      logger.Log(`${i}: diff if ${diff}`);
    } while (x != x_);

    return x;
  }

  let m = 1n;
  let s = num;
  while (s > 999999999n) {
    s /= 100n;
    m *= 10n;
  }

  const a = BigInt(Math.ceil(Math.sqrt(Number(s))));
  const estimate = a * m;

  let result = HeronMethod(num, estimate);

  logger.Log(`Result: ${result}`);

  if (result * result != num) {
    logger.Log(
      `result_diff /result-1iff: ${Number(result * result - num) / Number((result - 1n) * (result - 1n) - num)}`,
    );
    logger.Log(
      `result_diff /result+1iff: ${Number(result * result - num) / Number((result + 1n) * (result + 1n) - num)}`,
    );
  }

  const ratio = Math.abs(Number(result * result - num) / Number((result + 1n) * (result + 1n) - num));

  if (num - result * result > (result + 1n) * (result + 1n) - num) {
    logger.Log('Increasing the result by 1');
    ++result;
  }

  logger.Log(`Ratio: ${ratio}`);

  return result;
}

export function HammingCodesIntegerToEncodedBinary(num: number, logger: Logger) {
  /*type: HammingCodes: Integer to Encoded Binary data: 6221, desc: You are given the following decimal value: 
    6221 
  
    Convert it to a binary representation and encode it as an 'extended Hamming code'.
      The number should be converted to a string of '0' and '1' with no leading zeroes.
    An 'extended Hamming code' has an additional parity bit to enhance error detection.
    A parity bit is inserted at every position N where N is a power of 2, with the additional parity bit at position 0.
    Parity bits are used to make the total number of '1' bits in a given set of data even.
    Each parity bit at position N alternately considers N bits then ignores N bits, starting at and including position N.
    The additional parity bit at position 0 considers all bits including parity bits.
    For example, the parity bit at position 2 considers bits 2 to 3 and 6 to 7. The parity bit at position 1 considers bits 1, 3, 5 and 7.
    The endianness of the parity bits is reversed compared to the endianness of the data bits:
    Data bits are encoded most significant bit first and the parity bits encoded least significant bit first.
    The additional parity bit at position 0 is set last.
  
    Examples:
  
    8 in binary is 1000, and encodes to 11110000 (pppdpddd - where p is a parity bit and d is a data bit)
    21 in binary is 10101, and encodes to 1001101011 (pppdpdddpd)
  
    For more information on the 'rule' of encoding, refer to Wikipedia (https://wikipedia.org/wiki/Hamming_code) or the 3Blue1Brown videos on Hamming Codes. (https://youtube.com/watch?v=X8jsijhllIA)
    NOTE: The wikipedia entry does not cover the specific 'extended Hamming code' structure used in this contract., diff: 6*/

  const binary = num
    .toString(2)
    .split('')
    .map((s) => Number(s));
  let code = [] as number[];
  let pd = [] as string[];
  let data_positions = 0;
  let parity_bit = 0;

  // @ignore-infinite
  do {
    parity_bit++;
    pd.push('p');
    if (parity_bit > 1) {
      pd.push(...'d'.repeat(2 ** (parity_bit - 1) - 1).split(''));
      data_positions += 2 ** (parity_bit - 1) - 1;
    }
  } while (data_positions < binary.length);

  let result_ind = 0;
  for (let data_ind = 0; data_ind < binary.length; ++data_ind) {
    while (result_ind < pd.length && pd[result_ind] == 'p') ++result_ind;
    code[result_ind++] = binary[data_ind];
  }

  code = [0, ...code];
  pd = ['p', ...pd];

  let pairity_bits = [] as number[];
  for (let p = 0; p < parity_bit; ++p) pairity_bits[2 ** p] = 0;
  pairity_bits[0] = 0;

  for (let parity_ind = result_ind; parity_ind >= 0; --parity_ind) {
    if (pd[parity_ind] == 'p') {
      const p_len = parity_bit ? 2 ** (parity_bit - 1) : 0;
      --parity_bit;
      code[parity_ind] = pairity_bits[p_len];
      pairity_bits = pairity_bits.splice(0, p_len);
    }
    for (const p of Object.keys(pairity_bits).map((s) => Number(s))) {
      if (p == 0 || Math.floor(parity_ind / p) % 2 == 1) {
        pairity_bits[p] ^= code[parity_ind];
      }
    }
  }

  logger.Log(`Number: ${num}, Code: ${code}`);

  return code.join('');
}

function CompressionIRLECompression(data: string, logger: Logger) {
  /*type: Compression I: RLE Compression 
    data: FFFFFHl5HHkkIIyyyyyyyyTTTTTTQQQQQ2xuuuuuuuuuuuuuunbb666668888888wwffOuDnJJf88, 
    desc: Run-length encoding (RLE) is a data compression technique which encodes data as a series of runs of a repeated single character. Runs are encoded as a length, followed by the character itself. Lengths are encoded as a single ASCII digit; runs of 10 characters or more are encoded by splitting them into multiple runs.
  
    You are given the following input string:
        FFFFFHl5HHkkIIyyyyyyyyTTTTTTQQQQQ2xuuuuuuuuuuuuuunbb666668888888wwffOuDnJJf88
    Encode it using run-length encoding with the minimum possible output length.
  
    Examples:
  
        aaaaabccc            ->  5a1b3c
        aAaAaA               ->  1a1A1a1A1a1A
        111112333            ->  511233
        zzzzzzzzzzzzzzzzzzz  ->  9z9z1z  (or 9z8z2z, etc.), diff: 2*/

  function CompressRLE(data: string) {
    const compressed = [] as string[];
    let cur_symbol = '';
    let cur_count = 0;

    for (const d of data.split('')) {
      if (cur_count == 9 || (cur_count > 0 && d != cur_symbol)) {
        compressed.push(cur_count.toString(), cur_symbol);
        cur_count = 0;
      }
      if (cur_count == 0) {
        cur_symbol = d;
      }
      ++cur_count;
    }
    if (cur_count > 0) compressed.push(cur_count.toString(), cur_symbol);
    return compressed.join('');
  }

  const compressed = CompressRLE(data);

  logger.Log(`Data: '${data}', Compress: '${compressed}'`);

  return compressed;
}

export function FindAllValidMathExpressions([data, result]: [string, number], logger: Logger) {
  const known_formulas: Record<string, string[]> = {};
  /*type: Find All Valid Math Expressions
    data: 6306288607,-87, desc: You are given the following string which contains only digits between 0 and 9:

    6306288607

    You are also given a target number of -87. Return all possible ways you can add the +(add), -(subtract), and *(multiply) operators to the string such that it evaluates to the target number. (Normal order of operations applies.)

    The provided answer should be an array of strings containing the valid expressions. The data provided by this problem is an array with two elements. The first element is the string of digits, while the second element is the target number:

    ["6306288607", -87]

    NOTE: The order of evaluation expects script operator precedence.
    NOTE: Numbers in the expression cannot have leading 0's. In other words, "1+01" is not a valid expression.

    Examples:

    Input: digits = "123", target = 6
    Output: ["1+2+3", "1*2*3"]

    Input: digits = "105", target = 5
    Output: ["1*0+5", "10-5"], diff: 10*/

  function split_expr(expr_left: string, expr_right: string, value_diff: number, last_term: number) {
    if (expr_right.length == 0) {
      if (value_diff == 0) {
        return [''];
      } else return [];
    }

    const expr_key = `${expr_right},${value_diff},${last_term}`;
    if (known_formulas[expr_key]) return known_formulas[expr_key];

    let term = '';
    const ret: string[] = [];
    while (expr_right.length > 0) {
      term += expr_right.slice(0, 1);
      expr_right = expr_right.slice(1);
      const term_value = Number(term);
      if (expr_left == '')
        ret.push(...split_expr(term, expr_right, value_diff - term_value, term_value).map((r) => term + r));
      else {
        ret.push(
          ...split_expr(expr_left + '+' + term, expr_right, value_diff - term_value, term_value).map(
            (r) => '+' + term + r,
          ),
        );
        ret.push(
          ...split_expr(expr_left + '-' + term, expr_right, value_diff + term_value, -term_value).map(
            (r) => '-' + term + r,
          ),
        );
        ret.push(
          ...split_expr(
            expr_left + '*' + term,
            expr_right,
            value_diff - (term_value - 1) * last_term,
            last_term * term_value,
          ).map((r) => '*' + term + r),
        );
      }
      if (term == '0') break;
    }

    known_formulas[expr_key] = ret;
    return ret;
  }

  const ret = split_expr('', data, result, 0);
  logger.Log(`['${data}', ${result}] -> ${JSON.stringify(ret)}`);
  return ret;
}

function GenerateIPAddressesData(data: string, logger: Logger) {
  /*type: Generate IP Addresses data: 16929246163, desc: Given the following string containing only digits, return an array with all possible valid IP address combinations that can be created from the string:

    16929246163

    Note that an octet cannot begin with a '0' unless the number itself is exactly '0'. For example, '192.168.010.1' is not a valid IP.

    Examples:

    25525511135 -> ["255.255.11.135", "255.255.111.35"]
    1938718066 -> ["193.87.180.66"], diff: 3 */
  const digits = data.split('');
  const ret = [] as string[];

  for (let lens_ind = 0; lens_ind < 3 ** 4; ++lens_ind) {
    const lens = lens_ind
      .toString(3)
      .padStart(4, '0')
      .split('')
      .map((s) => Number(s) + 1);
    if (lens.reduce((a, b) => a + b) != digits.length) continue;

    const parts = [] as string[];
    const digits_copy = [...digits];
    lens.forEach((l) => parts.push(digits_copy.splice(0, l).join('')));
    if (parts.some((p) => (p.length > 1 && p[0] == '0') || Number(p) > 255)) continue;
    ret.push(parts.join('.'));
  }

  logger.Log(`${data} -> ${ret}`);

  return ret;
}

function Proper2ColoringOfAGraph([node_count, links]: [number, [number, number][]], logger: Logger) {
  /*type: Proper 2-Coloring of a Graph data: 9,1,6,0,5,6,8,3,5,0,2,0,3,2,4,0,1,4,8,0,8,3,4, desc: You are given the following data, representing a graph:
    [9,[[1,6],[0,5],[6,8],[3,5],[0,2],[0,3],[2,4],[0,1],[4,8],[0,8],[3,4]]]
    Note that "graph", as used here, refers to the field of graph theory, and has no relation to statistics or plotting. 
    The first element of the data represents the number of vertices in the graph. Each vertex is a unique number between 0 and 8. 
    The next element of the data represents the edges of the graph. Two vertices u,v in a graph are said to be adjacent if there exists an edge [u,v]. 
    Note that an edge [u,v] is the same as an edge [v,u], as order does not matter. You must construct a 2-coloring of the graph, 
    meaning that you have to assign each vertex in the graph a "color", either 0 or 1, such that no two adjacent vertices have the same color. 
    Submit your answer in the form of an array, where element i represents the color of vertex i. If it is impossible to construct a 2-coloring 
    of the given graph, instead submit an empty array.

    Examples:

    Input: [4, [[0, 2], [0, 3], [1, 2], [1, 3]]]
    Output: [0, 0, 1, 1]

    Input: [3, [[0, 1], [0, 2], [1, 2]]]
    Output: [], diff: 7*/
  const ret = [] as number[];
  const visited_nodes = [] as boolean[];
  function colorNode(node: number, color: number) {
    if (ret[node] === undefined) {
      logger.Log(`Colored ${node} to ${color}`);
      ret[node] = color;
    }

    visited_nodes[node] = true;

    const next_color = 1 - color;

    for (const l of links) {
      let next_node: number | undefined;
      if (node == l[0]) next_node = l[1];
      if (node == l[1]) next_node = l[0];

      if (next_node === undefined) continue;
      if (ret[next_node] !== undefined) {
        if (ret[next_node] != next_color) return false;
      } else if (!colorNode(next_node, next_color)) return false;
    }

    return true;
  }
  let success = colorNode(0, 0);
  if (success) {
    for (let node = 0; node < node_count; ++node) {
      if (ret[node] === undefined) {
        success &&= colorNode(node, 0);
      }
    }
  }

  logger.Log(`${success ? 'Success!' : 'Unsuccessful'}: ${ret}`);
  return success ? ret : [];
}

export function TotalWaysToSumII([num, array]: [number, number[]], logger: Logger) {
  /*Total Ways to Sum II data: [139,[1,2,3,5,9,11,12,13,15,19,21,22]], 
    desc: How many different distinct ways can the number 183 be written as a sum of integers contained in the set:

    [1,3,11,14,20,21,22,23]?

    You may use each integer in the set zero or more times., diff: 2*/
  const hash = `${JSON.stringify(array)}=${num}`;
  if (known_ways[hash] !== undefined) return known_ways[hash];

  array = [...array];
  while (num < (array.at(-1) ?? 0)) array.pop();

  if (array.length == 1) {
    if (num % array[0] === 0) {
      known_ways[hash] = 1;
      return 1;
    } else {
      known_ways[hash] = 0;
      return 0;
    }
  }
  if (array.length == 0) {
    known_ways[hash] = 0;
    return 0;
  }
  const elem = array.pop() ?? Infinity;
  let ways = 0;
  const limit = Math.floor(num / elem);
  for (let mult = 0; mult <= limit; ++mult) {
    ways += TotalWaysToSumII([num - mult * elem, array], logger);
  }
  if (num % elem == 0) {
    ++ways;
  }
  known_ways[hash] = ways;
  logger.Log(`TotalWaysToSumII(${num}, ${JSON.stringify(array)}) = ${ways}`);
  return ways;
}

export function ShortestPathInAGrid(grid: number[][], logger: Logger) {
  /*type: Shortest Path in a Grid data: [[0,0,0,1,0,0,0,0,1,0,1],[1,1,1,0,0,0,0,0,1,1,0],[0,0,0,0,0,0,0,1,0,0,0],[0,0,0,0,0,0,0,1,1,1,0],[0,1,1,0,1,0,0,0,1,0,0],[0,0,0,0,0,0,0,0,0,0,0],[0,0,1,0,0,1,0,0,0,0,0],[0,1,0,0,0,0,1,0,0,0,1],[1,0,0,0,1,0,0,0,0,0,1],[1,1,0,0,0,0,0,1,0,0,0],[1,1,0,0,0,0,0,0,0,1,0],[0,1,0,0,0,0,0,0,0,0,0]], desc: You are located in the top-left corner of the following grid:

     [[0,0,0,1,0,0,0,0,1,0,1],
     [1,1,1,0,0,0,0,0,1,1,0],
     [0,0,0,0,0,0,0,1,0,0,0],
     [0,0,0,0,0,0,0,1,1,1,0],
     [0,1,1,0,1,0,0,0,1,0,0],
     [0,0,0,0,0,0,0,0,0,0,0],
     [0,0,1,0,0,1,0,0,0,0,0],
     [0,1,0,0,0,0,1,0,0,0,1],
     [1,0,0,0,1,0,0,0,0,0,1],
     [1,1,0,0,0,0,0,1,0,0,0],
     [1,1,0,0,0,0,0,0,0,1,0],
     [0,1,0,0,0,0,0,0,0,0,0]]

    You are trying to find the shortest path to the bottom-right corner of the grid, but there are obstacles on the grid that you cannot move onto. These obstacles are denoted by '1', while empty spaces are denoted by 0.

    Determine the shortest path from start to finish, if one exists. The answer should be given as a string of UDLR characters, indicating the moves along the path

    NOTE: If there are multiple equally short paths, any of them is accepted as answer. If there is no path, the answer should be an empty string.
    NOTE: The data returned for this contract is an 2D array of numbers representing the grid.

    Examples:

       [[0,1,0,0,0],
        [0,0,0,1,0]]

    Answer: 'DRRURRD'

       [[0,1],
        [1,0]]

    Answer: "", diff: 7*/

  const shifts = [
    { dir: 'R', d: [0, 1] },
    { dir: 'D', d: [1, 0] },
    { dir: 'L', d: [0, -1] },
    { dir: 'U', d: [-1, 0] },
  ];

  const size = [grid.length, grid[0].length];
  const next_crawl = [{ y: size[0] - 1, x: size[1] - 1, distance: 0 }];
  const shortest_path: number[][] = [];
  for (let ind_y = 0; ind_y < size[0]; ind_y++) {
    shortest_path.push([]);
    for (let ind_x = 0; ind_x < size[1]; ind_x++) {
      shortest_path[ind_y].push(Infinity);
    }
  }
  while (next_crawl.length > 0) {
    const cur_pos = next_crawl.shift();
    if (cur_pos === undefined) break;

    shortest_path[cur_pos.y][cur_pos.x] = cur_pos.distance;
    for (const {
      d: [dx, dy],
    } of shifts) {
      if (
        cur_pos.y + dy >= 0 &&
        cur_pos.y + dy < size[0] &&
        cur_pos.x + dx >= 0 &&
        cur_pos.x + dx < size[1] &&
        grid[cur_pos.y + dy][cur_pos.x + dx] === 0
      ) {
        if (cur_pos.distance + 1 < shortest_path[cur_pos.y + dy][cur_pos.x + dx]) {
          next_crawl.push({ y: cur_pos.y + dy, x: cur_pos.x + dx, distance: cur_pos.distance + 1 });
        }
      }
    }

    if (shortest_path[0][0] !== Infinity) break;
  }

  let path = '';
  if (shortest_path[0][0] === Infinity) {
    logger.Log(`Could not find the first step`);
    return path;
  }

  logger.Log(`${JSON.stringify(grid)} -> ${JSON.stringify(shortest_path)}`);

  let cur_pos = { x: 0, y: 0, distance: shortest_path[0][0] };
  while (cur_pos.y != size[0] - 1 || cur_pos.x != size[1] - 1) {
    let found_next_step = false;
    for (const shift of shifts) {
      if (
        cur_pos.y + shift.d[0] >= 0 &&
        cur_pos.y + shift.d[0] < size[0] &&
        cur_pos.x + shift.d[1] >= 0 &&
        cur_pos.x + shift.d[1] < size[1] &&
        shortest_path[cur_pos.y + shift.d[0]][cur_pos.x + shift.d[1]] === cur_pos.distance - 1
      ) {
        cur_pos = { x: cur_pos.x + shift.d[1], y: cur_pos.y + shift.d[0], distance: cur_pos.distance - 1 };
        path = path + shift.dir;
        found_next_step = true;
        break;
      }
    }
    if (!found_next_step) {
      logger.Log(`Could not find next step`);
      return '';
    }
  }
  return path;
}

function UniquePathInAGridII(grid: number[][], logger: Logger) {
  /*Unique Paths in a Grid II data: [[0,0,0,0],[0,0,1,0],[0,0,0,0],[1,0,0,0]], desc: You are located in the top-left corner of the following grid:

    0,0,1,0,0,1,0,0,1,
    0,0,0,0,0,0,1,0,0,

    You are trying to reach the bottom-right corner of the grid, but you can only move down or right on each step. 
    Furthermore, there are obstacles on the grid that you cannot move onto. These obstacles are denoted by '1', while empty spaces are denoted by 0.

    Determine how many unique paths there are from start to finish.

    NOTE: The data returned for this contract is an 2D array of numbers representing the grid., diff: 5*/

  const unique_way = [] as number[][];
  for (let r = 0; r < grid.length; ++r) {
    unique_way[r] = [];
    for (let c = 0; c < grid[0].length; ++c) {
      if (r === 0 && c === 0) {
        unique_way[r][c] = 1;
      } else if (grid[r][c] > 0) {
        unique_way[r][c] = 0;
      } else {
        const left = c > 0 ? unique_way[r][c - 1] : 0;
        const up = r > 0 ? unique_way[r - 1][c] : 0;
        unique_way[r][c] = left + up;
      }
    }
  }

  return unique_way.at(-1)?.at(-1) ?? 0;
}

function SpiralizeMatrix(matrix: number[][], logger: Logger) {
  /*type: Spiralize Matrix data: [[20,35,2,3,4,18,32,36,16,48,30,10,4,17,48],[24,27,9,12,5,47,28,8,28,20,7,22,13,42,24],[33,38,29,47,29,34,21,5,37,34,11,15,34,27,16],[21,31,17,42,4,29,19,40,14,31,15,38,12,9,29],[19,49,25,26,14,40,10,28,15,7,1,32,25,31,3],[46,41,37,9,8,31,3,13,45,45,32,5,19,45,47]], 
    desc: Given the following array of arrays of numbers representing a 2D matrix, return the elements of the matrix as an array in spiral order:

        [
            [20,35, 2, 3, 4,18,32,36,16,48,30,10, 4,17,48]
            [24,27, 9,12, 5,47,28, 8,28,20, 7,22,13,42,24]
            [33,38,29,47,29,34,21, 5,37,34,11,15,34,27,16]
            [21,31,17,42, 4,29,19,40,14,31,15,38,12, 9,29]
            [19,49,25,26,14,40,10,28,15, 7, 1,32,25,31, 3]
            [46,41,37, 9, 8,31, 3,13,45,45,32, 5,19,45,47]
        ]

    Here is an example of what spiral order should be:

        [
            [1, 2, 3]
            [4, 5, 6]
            [7, 8, 9]
        ]

    Answer: [1, 2, 3, 6, 9, 8 ,7, 4, 5]

    Note that the matrix will not always be square:

        [
            [1,  2,  3,  4]
            [5,  6,  7,  8]
            [9, 10, 11, 12]
        ]

    Answer: [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7], diff: 2 */

  const ret: number[] = [];
  const bounds = {
    left: 0,
    upper: 0,
    right: matrix[0].length,
    bottom: matrix.length,
  };

  let stage = 0;
  while (bounds.left < bounds.right && bounds.upper < bounds.bottom) {
    switch (stage) {
      case 0:
        for (let c = bounds.left; c < bounds.right; ++c) {
          ret.push(matrix[bounds.upper][c]);
        }
        ++bounds.upper;
        break;
      case 1:
        --bounds.right;
        for (let r = bounds.upper; r < bounds.bottom; ++r) {
          ret.push(matrix[r][bounds.right]);
        }
        break;
      case 2:
        --bounds.bottom;
        for (let c = bounds.right - 1; c >= bounds.left; --c) {
          ret.push(matrix[bounds.bottom][c]);
        }
        break;
      case 3:
        for (let r = bounds.bottom - 1; r >= bounds.upper; --r) {
          ret.push(matrix[r][bounds.left]);
        }
        ++bounds.left;
    }
    stage = (stage + 1) % 4;
  }
  logger.Log(`${JSON.stringify(matrix)} -> [${ret}]`);
  return ret;
}

export function SanitizeParenthesesInExpression(expr: string, logger: Logger) {
  /*type: Sanitize Parentheses in Expression data: "())(a()", desc: Given the following string:

    ())(a()

    remove the minimum number of invalid parentheses in order to validate the string. If there are multiple minimal ways to validate the string, provide all of the possible results. The answer should be provided as an array of strings. If it is impossible to validate the string the result should be an array with only an empty string.

    IMPORTANT: The string may contain letters, not just parentheses.

    Examples:

    "()())()" -> ["()()()", "(())()"]
    "(a)())()" -> ["(a)()()", "(a())()"]
    ")(" -> [""], diff: 10*/

  const open_brace = '(';
  const close_brace = ')';
  const is_brace = (s: string) => s === open_brace || s === close_brace;

  const total_count = {
    [open_brace]: 0,
    [close_brace]: 0,
  } as { [key: string]: number };

  for (let ind = 0; ind < expr.length; ++ind) {
    if (is_brace(expr[ind])) total_count[expr[ind]] += 1;
  }

  function sanitize(
    res: string,
    expr_left: string,
    count_added: typeof total_count = { [open_brace]: 0, [close_brace]: 0 },
    count_removed: typeof total_count = { [open_brace]: 0, [close_brace]: 0 },
  ) {
    logger.Log(`sanitize('${res}', '${expr_left}', ${JSON.stringify(count_added)})`);
    if (expr_left.length == 0) {
      return count_added[open_brace] == count_added[close_brace] ? [res] : [];
    }

    const count_left = {
      [open_brace]: total_count[open_brace] - count_added[open_brace] - count_removed[open_brace],
      [close_brace]: total_count[close_brace] - count_added[close_brace] - count_removed[close_brace],
    };

    let can_add = true;
    let can_remove = false;

    const unclosed_open_braces = count_added[open_brace] - count_added[close_brace];
    if (expr_left[0] == open_brace) {
      can_add = unclosed_open_braces + 1 <= count_left[close_brace];
      can_remove =
        count_added[close_brace] + count_left[close_brace] <= count_added[open_brace] + count_left[open_brace];
    } else if (expr_left[0] == close_brace) {
      can_add = unclosed_open_braces > 0;
      can_remove = unclosed_open_braces <= count_left[close_brace];
    }

    const ret = [] as string[];
    if (can_add) {
      const count_added_next = { ...count_added };
      if (is_brace(expr_left[0])) count_added_next[expr_left[0]] += 1;
      ret.push(...sanitize(res + expr_left[0], expr_left.slice(1), count_added_next, count_removed));
    }
    if (can_remove) {
      const count_removed_next = { ...count_removed };
      if (is_brace(expr_left[0])) count_removed_next[expr_left[0]] += 1;
      ret.push(...sanitize(res, expr_left.slice(1), count_added, count_removed_next));
    }
    return ret;
  }

  let ret = sanitize('', expr, { [open_brace]: 0, [close_brace]: 0 });
  logger.Log(`'${expr}' -> ${JSON.stringify(ret)}`);
  ret = ret.sortby((s) => s.length, false);
  ret = ret.filter((s) => s.length == ret[0].length);
  return ret.length ? [...new Set(ret)] : [''];
}

export function MinimumPathSumInATriangle(triangle: number[][], logger: Logger) {
  /*type: Minimum Path Sum in a Triangle data: [[5],[3,2],[6,1,2],[8,4,8,7],[8,4,1,4,8],[2,8,1,5,8,8],[1,9,9,8,2,4,3],[1,7,6,6,1,6,8,3],[1,3,4,2,4,9,1,2,2]],
  desc: Given a triangle, find the minimum path sum from top to bottom. In each step of the path, you may only move to adjacent numbers in the row below. The triangle is represented as a 2D array of numbers:

  [
          [5],
         [3,2],
        [6,1,2],
       [8,4,8,7],
      [8,4,1,4,8],
     [2,8,1,5,8,8],
    [1,9,9,8,2,4,3],
   [1,7,6,6,1,6,8,3],
  [1,3,4,2,4,9,1,2,2]
  ]

  Example: If you are given the following triangle:

  [
      [2],
     [3,4],
    [6,5,7],
   [4,1,8,3]
  ]

  The minimum path sum is 11 (2 -> 3 -> 5 -> 1)., diff: 5*/
  function traverse_triangle(path: number[], last_step: number): [number, number[]] {
    const current_line = path.length;
    if (current_line == triangle.length) return [0, []];

    let min_path = [Infinity, []] as [number, number[]];

    for (let step = last_step; step <= last_step + 1 && step < triangle[current_line].length; step++) {
      const step_value = triangle[current_line][step];
      const sub_path = traverse_triangle([...path, triangle[current_line][step]], step);
      if (sub_path[0] + step_value < min_path[0]) min_path = [sub_path[0] + step_value, [step_value, ...sub_path[1]]];
    }

    return min_path;
  }

  const ret = traverse_triangle([], 0);
  logger.Log(`${JSON.stringify(triangle)} -> ${JSON.stringify(ret)}`);
  return ret[0];
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
  if (GetLastArgument(data, args) == '--type') {
    return Object.values(data.enums.CodingContractName)
      .filter((v) => !(v in known_types))
      .map((v) => JSON.stringify(v));
  }
  data.flags(flags_data);
  return ['--tail'];
}
