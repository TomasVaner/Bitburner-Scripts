import { PortNumbers } from '@/utility/constants';
import { NSLogger } from '@/utility/log';
import { NewPasswordPacket } from '@/utility/network_packets';

export async function main(ns: NS) {
  const [hostname] = ns.args as [string];

  let details = ns.dnet.getServerDetails(hostname);
  if (details.modelId.length == 0) return;
  const model_id = details.modelId.replaceAll(' ', '_');

  const logger = new NSLogger(ns, { extra_name: `${model_id.replaceAll(' ', '_')}/${hostname}` });

  const res = await authenticate(hostname);
  details = ns.dnet.getServerDetails(hostname);
  if (!res.success) {
    if (
      details.isConnectedToCurrentServer &&
      details.isOnline &&
      details.requiredCharismaSkill <= ns.getPlayer().skills.charisma
    ) {
      debugger;
      logger.Log(
        `WARNING: ${ns.getHostname()} -> ${hostname}: ${details.modelId} ${JSON.stringify(
          details,
        )} CHA:${ns.dnet.getServerRequiredCharismaLevel(hostname)}/${ns.getPlayer().skills.charisma} ${
          res.source
        } log provided: ${ns.fileExists(logger.log_file)} (${logger.log_file}). Initial model_id: ${model_id}`,
        { global_log: true },
      );
      if (ns.fileExists(logger.log_file)) ns.scp(logger.log_file, 'home');

      ns.ui.openTail();
    }
  } else {
    if (res.pass === undefined)
      throw `${ns.getHostname()} -> ${hostname}: ${details.modelId} ${JSON.stringify(
        details,
      )} CHA:${ns.dnet.getServerRequiredCharismaLevel(hostname)} ${res.source} log provided: ${ns.fileExists(
        logger.log_file,
      )} (${logger.log_file}). Initial model_id: ${model_id}`;
    const pass_data = new NewPasswordPacket(hostname, details.modelId, res.pass, res.source);
    ns.writePort(PortNumbers.probe_controller_in, JSON.stringify(pass_data));
    logger.Log(JSON.stringify(pass_data));
    //if (ns.fileExists(logger.log_file))
    //  ns.rm(logger.log_file);
  }

  async function authenticate(hostname: string) {
    const details = ns.dnet.getServerDetails(hostname);
    logger.Log(JSON.stringify(details));
    switch (details.modelId) {
      case 'ZeroLogon':
        return AuthenticateWithNoPassword(hostname);
      case 'DeskMemo_3.1':
        return AuthenticateWithMemo(hostname);
      case 'NIL':
        return AuthenticateWithNIL(hostname);
      case 'AccountsManager_4.2':
        return AuthenticateWithAccountsManager(hostname);
      case 'CloudBlare(tm)':
        return AuthenticateWithCloudBlare(hostname);
      case 'FreshInstall_1.0':
        return AuthenticateWithFreshInstall(hostname);
      case 'Factori-Os':
        return AuthenticateWithFactorio(hostname);
      case 'PHP 5.4':
        return AuthenticateWithPHP(hostname);
      case 'BellaCuore':
        return AuthenticateWithBellaCuore(hostname);
      case 'OctantVoxel':
        return AuthenticateWithOctantVoxel(hostname);
      case 'Laika4':
        return AuthenticateWithLaika4(hostname);
      case 'DeepGreen':
        return AuthenticateWithDeepGreen(hostname);
      case 'Pr0verFl0':
        return AuthenticateWithPr0verFl0(hostname);
      case 'OpenWebAccessPoint':
        return AuthenticateWithOpenWebAccessPoint(hostname);

      // TODO: handle other models of darknet servers here

      // TODO: get recent server logs with `await ns.dnet.heartbleed(hostname)` for more detailed logging on failed auth attempts

      default:
        if (details.isOnline && details.isConnectedToCurrentServer && details.modelId.length > 0)
          logger.Log(`ERROR: ${hostname}: Unrecognized modelId: ${details.modelId}, ${JSON.stringify(details)}`, {
            global_log: true,
          });
        return { success: false, source: 'Unknown model ID' };
    }
  }

  function SafeJSONParse(json: string): null | any {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  async function Heartbleed(hostname: string) {
    const ret = [] as any[];
    if (!IsServerReachable(hostname)) return ret;
    if (ns.dnet.getServerRequiredCharismaLevel(hostname) > ns.getPlayer().skills.charisma) return ret;

    const result = await ns.dnet.heartbleed(hostname, { peek: true, logsToCapture: 200 });
    if (!result.success) return ret;
    for (const log of result.logs) {
      const test_res = SafeJSONParse(log);
      if (test_res === null) {
        continue;
      }
      ret.push(test_res);
    }

    return ret;
  }

  function IsServerReachable(hostname: string) {
    const details = ns.dnet.getServerDetails(hostname);
    return details.isOnline && details.isConnectedToCurrentServer;
  }

  /** Authenticates on 'ZeroLogon' type servers, which always have an empty password.
   *  @param {NS} ns
   * @param {string} hostname - the name of the server to attempt to authorize on
   */
  async function AuthenticateWithNoPassword(hostname: string) {
    const result = await ns.dnet.authenticate(hostname, '');
    return { pass: '', success: result.success, source: 'authenticate' };
  }

  async function AuthenticateWithMemo(hostname: string) {
    const details = ns.dnet.getServerDetails(hostname);
    const pass = details.passwordHint.slice(-details.passwordLength);
    const result = await ns.dnet.authenticate(hostname, pass);
    return { pass: pass, success: result.success, source: 'authenticate' };
  }

  async function AuthenticateWithPr0verFl0(hostname: string) {
    const details = ns.dnet.getServerDetails(hostname);
    const pass = 'a'.repeat(details.passwordLength * 2);
    logger.Log(`Trying password ${pass}`);
    const result = await ns.dnet.authenticate(hostname, pass);
    return { pass: pass, success: result.success, source: 'authenticate' };
  }

  async function AuthenticateWithBellaCuore(hostname: string) {
    const details = ns.dnet.getServerDetails(hostname);
    const roman_numerals = new Map<string, number>([
      ['I', 1],
      ['V', 5],
      ['X', 10],
      ['L', 50],
      ['C', 100],
      ['D', 500],
      ['M', 1000],
    ]);
    let num = 0;
    for (let i = 0; i < details.data.length; ++i) {
      const value = roman_numerals.get(details.data[i]) ?? 0;
      const value_next = i < details.data.length - 1 ? roman_numerals.get(details.data[i + 1]) ?? 0 : 0;
      num += value < value_next ? -value : value;
    }
    const pass = num.toString().padStart(details.passwordLength, '0');
    logger.Log(`Trying password ${pass}`);
    const result = await ns.dnet.authenticate(hostname, pass);
    // TODO: store discovered passwords somewhere safe, in case we need them later
    return { pass: pass, success: result.success, source: 'authenticate' };
  }

  async function AuthenticateWithCloudBlare(hostname: string) {
    const details = ns.dnet.getServerDetails(hostname);
    let pass = '';
    logger.Log(details.data);
    for (let i = 0; i < details.data.length; ++i)
      if (details.data[i] >= '0' && details.data[i] <= '9') pass += details.data[i];
    const result = await ns.dnet.authenticate(hostname, pass);
    // TODO: store discovered passwords somewhere safe, in case we need them later
    return { pass: pass, success: result.success, source: 'authenticate' };
  }

  async function AuthenticateWithOctantVoxel(hostname: string) {
    const details = ns.dnet.getServerDetails(hostname);
    const [base_str, num_str] = details.data.split(',');
    const base = Number(base_str);
    const num = parseInt(num_str, base);

    const pass = num.toString().padStart(details.passwordLength, '0');
    const result = await ns.dnet.authenticate(hostname, pass);
    // TODO: store discovered passwords somewhere safe, in case we need them later
    return { pass: pass, success: result.success, source: 'authenticate' };
  }

  async function AuthenticateWithFreshInstall(hostname: string) {
    const details = ns.dnet.getServerDetails(hostname);

    const passwords = ['admin', 'password', '0000', '12345'];

    for (const pass of passwords.filter((p) => p.length == details.passwordLength)) {
      const result = await ns.dnet.authenticate(hostname, pass);
      if (result.success) return { pass: pass, success: true, source: 'authenticate' };
    }

    return { success: false, source: 'Out of tries' };
  }

  async function AuthenticateWithLaika4(hostname: string) {
    const details = ns.dnet.getServerDetails(hostname);

    const passwords = ['fido', 'spot', 'rover', 'max'];

    for (const pass of passwords.filter((p) => p.length == details.passwordLength)) {
      const result = await ns.dnet.authenticate(hostname, pass);
      if (result.success) return { pass: pass, success: true, source: 'authenticate' };
    }

    return { success: false, source: 'Out of tries' };
  }

  async function AuthenticateWithNIL(hostname: string) {
    let details = ns.dnet.getServerDetails(hostname);

    const alphabet = '0123456789'.split('');

    const yes = '_'.repeat(details.passwordLength).split('');
    const no = [] as string[][];

    for (let ind = 0; ind < details.passwordLength; ++ind) no.push([] as string[]);

    logger.Log(`alphabet: ${alphabet}`);
    let pass = '';

    while (true) {
      if (!IsServerReachable(hostname)) return { success: false, source: 'Server unreachable' };

      const logs = await Heartbleed(hostname);
      for (const log of logs) {
        logger.Log(JSON.stringify(log));
        if (log.code == 200) {
          const result = await ns.dnet.authenticate(hostname, log.passwordAttempted);
          if (result.success) {
            return { pass: log.passwordAttempted, success: true, source: 'heartbleed' };
          }
        } else {
          const y = log.data.split(',');
          for (let ind = 0; ind < y.length; ++ind) {
            if (y[ind] == 'yes') yes[ind] = log.passwordAttempted[ind];
            else if (!no[ind]?.includes(log.passwordAttempted[ind])) no[ind]?.push(log.passwordAttempted[ind]);
          }
        }
      }

      details = ns.dnet.getServerDetails(hostname);
      if (details.passwordLength != yes.length) return { success: false, source: 'Password length mismatch' };

      const pass_next = '_'.repeat(details.passwordLength).split('');

      for (let ind = 0; ind < details.passwordLength; ++ind) {
        if (yes[ind] != '_') pass_next[ind] = yes[ind];
        else {
          for (const l of alphabet) {
            if (no[ind].includes(l)) continue;
            pass_next[ind] = l;
            break;
          }
        }
        if (pass_next[ind] == '_') return { success: false, source: 'Could not find the next symbol' };
      }

      if (pass == pass_next.join('')) return { success: false, source: `Password cycle (${pass})` };
      pass = pass_next.join('');
      logger.Log(`Trying password ${pass}`);
      const result = await ns.dnet.authenticate(hostname, pass);
      if (result.success) {
        return { pass: pass, success: result.success, source: 'authenticate' };
      }
    }
  }

  async function AuthenticateWithAccountsManager(hostname: string) {
    let details = ns.dnet.getServerDetails(hostname);
    const regex = /The password is a number between (\d+) and (\d+)/;
    const match = details.passwordHint.match(regex);
    if (!match) {
      return { success: false, source: 'Regex failed' };
    }
    let [from, to] = [Number(match[1]), Number(match[2])];
    logger.Log(`Guessing pasword from ${from} to ${to}`);

    while (from <= to) {
      const logs = await Heartbleed(hostname);

      if (!IsServerReachable(hostname)) return { success: false, source: 'Server unreachable' };
      details = ns.dnet.getServerDetails(hostname);
      for (const log of logs) {
        logger.Log(JSON.stringify(log));
        if (log.passwordAttempted.length != details.passwordLength) continue;
        if (log.code == 200) {
          const result = await ns.dnet.authenticate(hostname, log.passwordAttempted);
          if (result.success) {
            return { pass: log.passwordAttempted, success: true, source: 'heartbleed' };
          }
        } else {
          const guess = Number(log.passwordAttempted);
          if (Number.isNaN(guess)) continue;
          if (log.data == 'Lower') {
            if (guess - 1 < to) logger.Log(`Reducing to: ${to} -> ${guess - 1}`);
            to = Math.min(to, guess - 1);
          } else if (log.data == 'Higher') {
            if (guess + 1 > to) logger.Log(`Increasing from: ${from} -> ${guess + 1}`);
            from = Math.max(from, guess + 1);
          }
        }
        logger.Log(`Range: ${[from, to]}`);
      }

      const guess = Math.round((from + to) / 2);
      const pass = guess.toString().padStart(details.passwordLength);
      logger.Log(`Trying password ${pass}`);
      const result = await ns.dnet.authenticate(hostname, pass);
      if (result.success) return { pass: pass, success: true, source: 'authenticate' };
    }
    return { success: false, source: 'Out of tries' };
  }

  async function AuthenticateWithFactorio(hostname: string) {
    const details = ns.dnet.getServerDetails(hostname);

    const divisors = [1];
    const non_divisors = [] as number[];

    for (let num = 0; num < 10 ** details.passwordLength; ++num) {
      if (non_divisors.some((n) => num % n == 0)) {
        const div = non_divisors.find((n) => num % n == 0);
        logger.Log(`skipping ${num}, it is divisible by ${div}`);
        continue;
      }
      if (divisors.some((n) => num % n != 0)) {
        const n_div = divisors.find((n) => num % n != 0);
        logger.Log(`skipping ${num}, it is not divisible by ${n_div}`);
        continue;
      }

      if (!IsServerReachable(hostname)) return { success: false, source: 'Server unreachable' };

      const logs = await Heartbleed(hostname);
      const num_before = num;
      for (const log of logs) {
        logger.Log(JSON.stringify(log));
        if (log.code == 200) {
          const result = await ns.dnet.authenticate(hostname, log.passwordAttempted);
          if (result.success) {
            return { pass: log.passwordAttempted, success: true, source: 'heartbleed' };
          } else logger.Log(`Password ${log.passwordAttempted} failed even though was got from heartbleed`);
        } else {
          const log_num = Number(log.passwordAttempted);
          if (num == log_num) num = log_num + 1;

          if (log_num == 0) continue;
          if (log.data == 'true') {
            if (!divisors.includes(log_num)) {
              logger.Log(`Pushing ${log_num} to divisers`);
              divisors.push(log_num);
            }
          } else if (log.data == 'false') {
            const log_num = Number(log.passwordAttempted);
            if (!non_divisors.includes(log_num)) {
              logger.Log(`Pushing ${log_num} to non-divisers`);
              non_divisors.push(log_num);
            }
          }
        }
      }

      logger.Log(`Non-divisors: ${non_divisors}`);
      logger.Log(`Divisors: ${divisors}`);

      if (num_before != num) logger.Log(`Skipped num: ${num_before} -> ${num}`);

      if (non_divisors.some((n) => num % n == 0)) {
        const div = non_divisors.find((n) => num % n == 0);
        logger.Log(`skipping ${num}, it is divisible by ${div}`);
        continue;
      }
      if (divisors.some((n) => num % n != 0)) {
        const n_div = divisors.find((n) => num % n != 0);
        logger.Log(`skipping ${num}, it is not divisible by ${n_div}`);
        continue;
      }

      const pass = num.toString().padStart(details.passwordLength, '0');
      logger.Log(`Trying password ${pass}`);
      const result = await ns.dnet.authenticate(hostname, pass);
      if (result.success) {
        return { pass: pass, success: result.success, source: 'authenticate' };
      }
    }
    return { success: false, source: 'Out of tries' };
  }

  async function AuthenticateWithPHP(hostname: string) {
    const details = ns.dnet.getServerDetails(hostname);
    const data = details.data.split('');
    const identity = [] as number[];
    const perm = [] as number[];
    for (let i = 0; i < details.passwordLength; ++i) {
      identity.push(i);
      perm.push(i);
    }

    let index_swap = details.passwordLength - 1;
    let counter = 0;

    do {
      if (!IsServerReachable(hostname)) return { success: false, source: 'Server unreachable' };

      const logs = await Heartbleed(hostname);
      for (const log of logs) {
        logger.Log(JSON.stringify(log));
        if (log.code == 200) {
          const result = await ns.dnet.authenticate(hostname, log.passwordAttempted);
          if (result.success) {
            return { pass: log.passwordAttempted, success: true, source: 'heartbleed' };
          }
        }
      }

      let pass = '';
      for (let i = 0; i < details.passwordLength; ++i) pass += data[perm[i]];

      logger.Log(`Trying password ${pass}`);
      const result = await ns.dnet.authenticate(hostname, pass);
      if (result.success) {
        return { pass: pass, success: true, source: 'authenticate' };
      }
      const t = perm[index_swap];
      perm[index_swap] = perm[index_swap - 1];
      perm[index_swap - 1] = t;
      --index_swap;
      if (index_swap == 0) index_swap = details.passwordLength - 1;
      counter++;
      if (counter > details.passwordLength ** details.passwordLength) break;
      logger.Log(`[${perm}] [${identity}] ${perm != identity} ${JSON.stringify(perm) != JSON.stringify(identity)}`);
    } while (JSON.stringify(perm) != JSON.stringify(identity));

    return { success: false, source: 'Out of tries' };
  }

  async function AuthenticateWithDeepGreen(hostname: string) {
    const details = ns.dnet.getServerDetails(hostname);

    const forbidden = [] as string[];
    const alphabet = '0123456789'.split('');

    for (let num = 0; num < 10 ** details.passwordLength; ++num) {
      let pass = num.toString().padStart(details.passwordLength, '0');
      if (pass.split('').some((d) => forbidden.includes(d))) {
        logger.Log(`Skipping ${pass}`);
        continue;
      }

      if (!IsServerReachable(hostname)) return { success: false, source: 'Server unreachable' };

      const logs = await Heartbleed(hostname);
      const num_before = num;
      for (const log of logs) {
        logger.Log(JSON.stringify(log));
        if (log.code == 200) {
          const result = await ns.dnet.authenticate(hostname, log.passwordAttempted);
          if (result.success) {
            return { pass: log.passwordAttempted, success: true, source: 'heartbleed' };
          } else logger.Log(`Password ${log.passwordAttempted} failed even though was got from heartbleed`);
        } else {
          const log_num = Number(log.passwordAttempted);
          if (num == log_num) num = log_num + 1;

          const [g, r] = log.data.split(',');
          const [green, red] = [Number(g), Number(r)];

          const pass_array = log.passwordAttempted.split('');

          if (green + red == 0) {
            for (const d of pass_array) {
              if (!forbidden.includes(d)) {
                logger.Log(`Addind ${d} to forbidden`);
                forbidden.push(d);
              }
            }
          }
          if (green + red == details.passwordLength) {
            for (const d of alphabet)
              if (!pass_array.includes(d) && !forbidden.includes(d)) {
                logger.Log(`Addind ${d} to forbidden`);
                forbidden.push(d);
              }
          }
        }
      }

      if (num_before != num) logger.Log(`Skipped num: ${num_before} -> ${num}`);

      logger.Log(`Forbidden: ${JSON.stringify(forbidden)}`);

      pass = num.toString().padStart(details.passwordLength, '0');
      logger.Log(`Trying password ${pass}`);
      if (pass.split('').some((d) => forbidden.includes(d))) {
        logger.Log(`Skipping ${pass}`);
        continue;
      }

      const result = await ns.dnet.authenticate(hostname, pass);
      if (result.success) {
        return { pass: pass, success: result.success, source: 'authenticate' };
      }
    }
    return { success: false, source: 'Out of tries' };
  }

  async function AuthenticateWithOpenWebAccessPoint(hostname: string) {
    const details = ns.dnet.getServerDetails(hostname);

    let pass = ns.pid.toString().padStart(details.passwordLength, '0');

    for (let t = 0; t < 2; ++t) {
      if (!IsServerReachable(hostname)) return { success: false, source: 'Server unreachable' };

      const logs = await Heartbleed(hostname);
      for (const log of logs) {
        logger.Log(JSON.stringify(log));
        if (log.code == 200) {
          const result = await ns.dnet.authenticate(hostname, log.passwordAttempted);
          if (result.success) {
            return { pass: log.passwordAttempted, success: true, source: 'heartbleed' };
          }
        } else {
          let escaped_host = '';
          for (const l of hostname.split('')) {
            if ('^$()+*.,?\\[]{}'.split('').includes(l)) escaped_host += '\\';
            escaped_host += l;
          }

          const regex = new RegExp(`${escaped_host}:(\\d{${details.passwordLength}})`);
          logger.Log(`Looking for a match to '${regex.source}'`);
          const match = log.data.match(regex);
          if (match) {
            pass = match[1];
          } else {
            logger.Log(`ERROR: password not  found in '${log.data}'`);
            return { success: false, source: 'Pass not found' };
          }
        }
      }

      logger.Log(`Trying password ${pass}`);
      const result = await ns.dnet.authenticate(hostname, pass);
      if (result.success) {
        return { pass: pass, success: result.success, source: 'authenticate' };
      }
    }
    return { success: false, source: 'Out of attempts' };
  }
}
