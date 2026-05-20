/** @param {NS} ns */
import { PortNumbers, Strings, ScriptNames, ProberScripts } from '@/utility/constants';
import { NSLogger } from '@/utility/log';
import { DarknetContractReportPacket, RequestPasswordPacket, RequestPasswordResponse } from '@/utility/network_packets';

export async function main(ns: NS) {
  ns.disableLog('getServerMaxRam');
  ns.disableLog('getServerUsedRam');
  ns.disableLog('dnet.probe');
  ns.disableLog('sleep');

  const logger = new NSLogger(ns);

  const [controller_pid] = ns.args as [number];
  ns.clearPort(ns.pid);

  const reported_contracts = [] as string[];

  while (true) {
    if (!ns.isRunning(controller_pid)) {
      logger.Log(`Controller is not running. Exiting now`);
      ns.exit();
    }

    for (const file of ns.ls(ns.getHostname())) {
      if (file.endsWith('.ts') || file.endsWith('.js')) continue;

      if (file.endsWith('.cct') && !reported_contracts.includes(file)) {
        //let return_obj = {type:"solve_result", ctype:ctype, file:(train?"":file), server:server, reward:reward, pid:ns.pid};
        const report_obj = new DarknetContractReportPacket(ns.getHostname(), file);

        ns.writePort(PortNumbers.contract_scanner_in, JSON.stringify(report_obj));
        reported_contracts.push(file);
      }
      //ns.tprint(`INFO:${ns.getHostname()}/${file}: ${ns.read(file)}\n`);
    }

    // Get a list of all darknet hostnames directly connected to the current server
    const nearbyServers = ns.dnet.probe();
    logger.Log(`Found ${nearbyServers}`);

    let all_neighbours_connected = true;
    // Attempt to authenticate with each of the nearby servers, and spread this script to them
    for (const hostname of nearbyServers) {
      const authenticationResult = await ServerSolver(hostname);
      if (!authenticationResult.success) {
        if (all_neighbours_connected) logger.Log(`${hostname} is still disconnected`);
        all_neighbours_connected = false;
        continue;
      }

      if (!ns.isRunning(ScriptNames.prober, hostname, ...ns.args)) {
        logger.Log(`Copying script to ${hostname}`);
        // If we have successfully authenticated, we can now copy and run this script on the target server

        for (const script of ProberScripts) ns.scp(script, hostname);

        ns.exec(
          ScriptNames.prober,
          hostname,
          {
            preventDuplicates: true, // This prevents running multiple copies of this script
          },
          ...ns.args,
        );
      }
    }

    // TODO: free up blocked ram on this server using ns.dnet.memoryReallocation
    if (ns.dnet.getBlockedRam() > 0) {
      ns.exec(ScriptNames.memory_reallocation, ns.getHostname());
    }

    if (ns.ls(ns.getHostname(), '.cache').length > 0 && !ns.isRunning(ScriptNames.open_chache)) {
      ns.exec(ScriptNames.open_chache, ns.getHostname());
    }

    if (all_neighbours_connected) {
      for (const hostname of nearbyServers) {
        if (hostname == 'darkweb') continue;
        if (ns.exec(ScriptNames.induce_server_migration, ns.getHostname(), 1, hostname))
          logger.Log(`Inducing instability in ${hostname}.`);
      }
      ns.exec(ScriptNames.phishing_attack, ns.getHostname());
    }

    await ns.sleep(5000);
  }

  /** Attempts to authenticate with the specified server using the Darknet API.
   * @param {NS} ns
   * @param {string} hostname - the name of the server to attempt to authorize on
   */
  async function ServerSolver(hostname: string) {
    // Get key info about the server, so we know what kind it is and how to authenticate with it
    const details = ns.dnet.getServerDetails(hostname);

    if (!details.isConnectedToCurrentServer || !details.isOnline) {
      // If the server isn't connected or is offline, we can't authenticate
      logger.Log(`${hostname} was disconnected`);
      return { success: false };
    }
    // If you are already authenticated to that server with this script, you don't need to do it again
    if (details.hasSession) {
      logger.Log(`${hostname} already has a session`);
      return { success: true };
    }

    const pw_req_data = new RequestPasswordPacket(hostname, details.modelId, ns.pid);
    logger.Log(`${ns.pid} -> ${PortNumbers.probe_controller_in}: Sending request`);
    ns.writePort(PortNumbers.probe_controller_in, JSON.stringify(pw_req_data));

    const return_data_json = await readPortInfo(ns.pid);

    logger.Log(`${ns.pid}: got data ${return_data_json}`);
    if (return_data_json && return_data_json != Strings.null_port_data) {
      const return_data = JSON.parse(return_data_json) as RequestPasswordResponse;
      if (return_data.password != undefined && return_data.hostname == hostname) {
        try {
          const result = await ns.dnet.authenticate(hostname, return_data.password);
          if (result.success) return { success: true };
        } catch (_) {
          logger.Log(`${ns.pid}: got data ${return_data_json}. Authentication failed!`, { global_log: true });
        }
      }
      logger.Log(`Got response from controller: ${JSON.stringify(return_data)}`);
    } else {
      logger.Log(`ERROR: Port ${ns.pid} was empty ${return_data_json}!`);
    }

    if (!ns.isRunning(ScriptNames.crack_password, ns.getHostname(), hostname, details.modelId)) {
      logger.Log(`starting script crack_password.js`);
      ns.exec(ScriptNames.crack_password, ns.getHostname(), 1, hostname, details.modelId);
    } else {
      logger.Log(`script crack_password.js is already running on ${hostname}`);
    }
    return { success: false };
  }

  async function readPortInfo(port: number) {
    if (ns.peek(port) !== Strings.null_port_data) return ns.readPort(port);
    else await ns.nextPortWrite(port);
    return ns.readPort(port);
  }
}
