export async function main(ns: NS) {
  const flag = ns.flags([
    ['enable', true],
    ['replace', ''],
    ['report_port', -1],
  ]);
  const enable = flag.enable as boolean;
  const replace = flag.replace as string;
  const report_port = flag.report_port as number;

  if (report_port === -1) {
    ns.atExit(() => {
      ns.writePort(report_port, 'done');
    }, ns.pid.toString());
  }

  if (replace.length > 0) {
    ns.clearPort(ns.pid);
    ns.killall(replace);
    ns.scp(ns.getScriptName(), replace);
    ns.exec(ns.getScriptName(), replace, 1, '--enable', false, '--report_port', ns.pid);
    await ns.nextPortWrite(ns.pid);
  }

  if (enable && ns.dnet.getStasisLinkedServers().length >= ns.dnet.getStasisLinkLimit()) {
    return;
  }
  await ns.dnet.setStasisLink(enable);
}
