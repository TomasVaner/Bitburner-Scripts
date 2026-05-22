import { NSLogger } from '@/utility/log';
import { HackOperationResultPacket, HackOperation } from '@/utility/network_packets';
import { ConvertToFlagsData, GetLastArgument, Hacking } from '@/utility/flags';

export const flags_struct: Hacking.HackArgs & Hacking.HackFinishAtArgs & Hacking.HackRunAtArgs & Hacking.HackDelayArgs =
  {
    compute_server: 'home',
    target: '',
    finish_at: -1,
    process_time: -1,
    run_at: -1,
    delay: -1,
    log_file: '',
    port_index: -1,
    operation: '' as HackOperation,
    log_prefix: '',
  };
const flags_data = ConvertToFlagsData(flags_struct);

export async function main(ns: NS) {
  const flag = ns.flags(flags_data) as typeof flags_struct;

  const logger = new NSLogger(ns, {
    log_file: flag.log_file,
    clean: false,
    extra_name: flag.target,
    create_file: false,
  });
  logger.prefix = `${ns.pid}${flag.log_prefix}: `;
  logger.include_timestamp = true;
  logger.logger_enabled = flag.log_file.length > 0;
  logger.Log(`args: ${JSON.stringify(ns.args)}`);
  if (flag.operation.length === 0) {
    throw 'Operation is not set!';
  }

  const ram_override = ns.ramOverride(1.6 + ns.getFunctionRamCost(flag.operation));
  logger.Log(
    `Overrided RAM to ${ram_override}, function ${flag.operation} ram: ${ns.getFunctionRamCost(flag.operation)}'`,
  );

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
      if (l.startsWith(`${flag.operation}:`)) logger.Log(l);
    }
  }
  if (flag.delay == -1) flag.delay = flag.run_at - performance.now();
  logger.Log(`Running ${flag.operation} on ${flag.target} in ${flag.delay}. Now is ${performance.now()}`);
  flag.delay = Math.max(0, flag.delay);

  const result = await ns[flag.operation](flag.target, { additionalMsec: flag.delay });

  ns.atExit(() => {
    if (flag.port_index != -1) {
      const return_data = new HackOperationResultPacket(
        flag.compute_server,
        flag.target,
        result,
        flag.operation,
        ns.pid,
      );
      ns.tryWritePort(flag.port_index, JSON.stringify(return_data));
    }
  });

  get_process_log();

  logger.Log(`operation ${flag.operation} ended on ${flag.target}. Result: ${result}`);
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
  if (GetLastArgument(data, args) == '--target') return [...data.servers];
  if (GetLastArgument(data, args) == '--operation') return ['hack', 'grow', 'weaken'];

  data.flags(flags_data);
  return ['--tail'];
}
