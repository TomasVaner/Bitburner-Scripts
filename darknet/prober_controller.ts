import { ScriptNames, FileNames, PortNumbers, ProberScripts } from '@/utility/constants';
import { NSLogger } from '@/utility/log';
import {
  PacketType,
  NetworkPacket,
  RequestPasswordResponse,
  NewPasswordPacket,
  RequestPasswordPacket,
} from '@/utility/network_packets';

export async function main(ns: NS) {
  ns.disableLog('dnet.getStasisLinkedServers');
  ns.disableLog('sleep');

  const incoming_port = ns.getPortHandle(PortNumbers.probe_controller_in);
  const darkweb = 'darkweb';
  const logger = new NSLogger(ns);
  logger.Log(`Max links: ${ns.dnet.getStasisLinkLimit()}`);

  let passwords: Record<string, string> = {};

  if (ns.fileExists(FileNames.password_database)) {
    passwords = JSON.parse(ns.read(FileNames.password_database));
  }

  function SavePasswords() {
    ns.write(FileNames.password_database, JSON.stringify(passwords), 'w');
  }

  while (true) {
    const entry_servers = [darkweb, ...ns.dnet.getStasisLinkedServers()];

    for (const server of entry_servers) {
      if (!ns.isRunning(ScriptNames.prober, server, ns.pid)) {
        for (const script of ProberScripts) ns.scp(script, server);

        ns.exec(ScriptNames.prober, server, 1, ns.pid);
      }
    }

    const sanitize_hostname = (hostname: string) => {
      switch (hostname) {
        case '__proto__':
          return '%5F%5fproto%5f%5f';
        default:
          return hostname;
      }
    };
    if (!incoming_port.empty()) {
      const packet = JSON.parse(incoming_port.read()) as NetworkPacket;
      logger.Log(JSON.stringify(packet));
      switch (packet.type) {
        case PacketType.new_password: {
          const data = packet as NewPasswordPacket;
          if (
            passwords[sanitize_hostname(data.hostname)] !== undefined &&
            passwords[sanitize_hostname(data.hostname)] != data.password
          ) {
            logger.Log(
              `WARNING: password for ${data.hostname} change: '${passwords[sanitize_hostname(data.hostname)]}' -> '${
                data.password
              }'`,
            );
          }
          if (passwords[sanitize_hostname(data.hostname)] != data.password) {
            const ignore_model_ids = [
              'ZeroLogon',
              'DeskMemo_3.1',
              'CloudBlare(tm)',
              'FreshInstall_1.0',
              'BellaCuore',
              'OctantVoxel',
              'Laika4',
              'Pr0verFl0',
              'Factori-Os',
              'PHP 5.4',
              'DeepGreen',
              'OpenWebAccessPoint',
              'AccountsManager_4.2',
              'NIL',
            ];
            if (!ignore_model_ids.includes(data.modelId))
              logger.Log(`INFO: new password for ${data.hostname} ${data.modelId}: '${data.password}' ${data.source}`, {
                global_log: true,
              });
          }
          passwords[sanitize_hostname(data.hostname)] = data.password;
          SavePasswords();
          break;
        }
        case PacketType.request_password: {
          const data = packet as RequestPasswordPacket;
          const return_data = new RequestPasswordResponse(data.hostname, passwords[sanitize_hostname(data.hostname)]);
          ns.writePort(data.pid, JSON.stringify(return_data));
          logger.Log(`${ns.pid} -> (${data.pid}) ${JSON.stringify(return_data)}`);
          break;
        }
      }
    }
    await ns.sleep(100);
  }
}
