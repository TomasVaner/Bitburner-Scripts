import { Logger } from '@/utility/log';
import { HackOperationResultPacket } from '@/utility/network_packets';
import { ConvertToFlagsData, Hacking } from '@/utility/flags';

const flags_struct: Hacking.HackArgs & Hacking.HackFinishAtArgs & Hacking.HackRunAtArgs & Hacking.HackDelayArgs = {
  target: '',
  finish_at: -1,
  process_time: -1,
  run_at: -1,
  delay: -1,
  log_file: '',
  port_index: -1,
  log_prefix: '',
};
const flags_data = ConvertToFlagsData(flags_struct);

export async function main(ns: NS) {
  const operation = 'hack';
  const flag = ns.flags(flags_data) as typeof flags_struct;

  const logger = new Logger(ns, { log_file: flag.log_file, clean: false, extra_name: flag.target, create_file: false });
  logger.prefix = `${ns.pid}${flag.log_prefix}: `;
  logger.include_timestamp = true;
  logger.logger_enabled = flag.log_file.length > 0;
  logger.Log(`args: ${JSON.stringify(ns.args)}`);

  if (flag.run_at == -1) {
    if (flag.finish_at != -1 && flag.process_time != -1) {
      flag.run_at = flag.finish_at - flag.process_time;
      logger.Log(
        `Now: ${performance.now()} Finish at: ${flag.finish_at} process_time: ${flag.process_time} => run_at: ${
          flag.run_at
        }`,
      );
    }
  } else {
    logger.Log(`Now: ${performance.now()} Run at: ${flag.run_at}`);
  }

  function get_process_log() {
    const logs = ns.getScriptLogs();
    for (const l of logs) {
      if (l.startsWith(`${operation}:`)) logger.Log(l);
    }
  }
  if (flag.delay == -1) flag.delay = flag.run_at - performance.now();
  logger.Log(`Running ${operation} on ${flag.target} in ${flag.delay}. Now is ${performance.now()}`);
  flag.delay = Math.max(0, flag.delay);

  const result = await ns.hack(flag.target, { additionalMsec: flag.delay });

  ns.atExit(() => {
    if (flag.port_index != -1) {
      const return_data = new HackOperationResultPacket(flag.target, result, operation, ns.pid);
      ns.tryWritePort(flag.port_index, JSON.stringify(return_data));
    }
  });

  get_process_log();

  //let moneyAvailable = ns.getServerMoneyAvailable(flag.target);
  //let result_str = `$${ns.format.number(moneyAvailable + result)} -> $${ns.format.number(moneyAvailable)}`;

  logger.Log(`operation ${operation} ended on ${flag.target}. Result: ${result}`);
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
  if (args.at(-1) == '--target' || (args.at(-2) == '--target' && !data.command.endsWith(' '))) return [...data.servers];

  /*if (args.at(-1) == "--operation" || (args.at(-2) == "--operation" && !data.command.endsWith(' ')))
    return ["hack", "grow", "weaken"];*/

  data.flags(flags_data);
  return ['--tail'];
}
