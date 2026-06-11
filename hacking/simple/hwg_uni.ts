import { NSLogger } from '@/utility/log';
import { HackOperationResultPacket, HackOperation } from '@/utility/network_packets';
import { ConvertToFlagsData, GetLastArgument, Hacking } from '@/utility/flags';

export const flags_struct: Hacking.HackDelayArgs = {
  target: '',
  delay: -1,
  log_file: '',
  port_index: -1,
  operation: '' as HackOperation,
};
const flags_data = ConvertToFlagsData(flags_struct);

export async function main(ns: NS) {
  const flag = ns.flags(flags_data) as typeof flags_struct;
  ns.disableLog(flag.operation);

  const result = await ns[flag.operation](flag.target, { additionalMsec: flag.delay });

  if (flag.port_index != -1)
    ns.atExit(() => {
      const return_data = new HackOperationResultPacket(flag.target, result, flag.operation, ns.pid);
      ns.tryWritePort(flag.port_index, JSON.stringify(return_data));
    });
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
  if (GetLastArgument(data, args) == '--target') return [...data.servers];
  if (GetLastArgument(data, args) == '--operation') return ['hack', 'grow', 'weaken'];

  data.flags(flags_data);
  return ['--tail'];
}
