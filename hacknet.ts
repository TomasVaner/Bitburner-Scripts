export async function main(ns: NS) {
  const [return_time = 3600] = ns.args as [number];
  ns.tprint(`Nodes: ${ns.hacknet.numNodes()}/${ns.hacknet.maxNumNodes()}. Return time: ${return_time}`);
  let mults = ns.getHacknetMultipliers();
  const formulas = ns.fileExists('Formulas.exe');
  //ns.tprint(`Multipliers: ${mults.production}, ${mults.purchaseCost} ${mults.levelCost},${mults.ramCost},${mults.coreCost}`)
  let total_production = 0;
  while (true) {
    let [min_return_time, index, type] = [Infinity, -1, -1];
    let hack_nets = ns.hacknet.numNodes();
    let money = ns.getPlayer().money;

    let total_money_produced = ns.getMoneySources().sinceInstall.hacknet;
    let total_money_spent = ns.getMoneySources().sinceInstall.hacknet_expenses;

    for (let i = 0; i < hack_nets; ++i) {
      let [level_inc, ram_inc, core_inc] = 
      [
        1.5 * mults.production, 
        0.01, 
        0.01
      ]

      let hack_net = ns.hacknet.getNodeStats(i);
      total_production += hack_net.production;

      if (formulas)
      {
        level_inc = ns.formulas.hacknetNodes.moneyGainRate(hack_net.level+1, hack_net.ram, hack_net.cores, mults.production) - hack_net.production;
        ram_inc = ns.formulas.hacknetNodes.moneyGainRate(hack_net.level, hack_net.ram*2, hack_net.cores, mults.production) - hack_net.production;
        core_inc = ns.formulas.hacknetNodes.moneyGainRate(hack_net.level, hack_net.ram, hack_net.cores + 1, mults.production) - hack_net.production;
      }
      let level_cost = ns.hacknet.getLevelUpgradeCost(i);
      let ram_cost = ns.hacknet.getRamUpgradeCost(i);
      let core_cost = ns.hacknet.getCoreUpgradeCost(i);

      let [level_ret, ram_ret, core_ret] = [level_cost/level_inc, ram_cost/ram_inc, core_cost/core_inc];
      if (level_cost < money && level_ret < min_return_time)
      {
        [min_return_time, index, type] = [level_ret, i, 0];
      }
      if (ram_cost < money && ram_ret < min_return_time)
      {
        [min_return_time, index, type] = [ram_ret, i, 1];
      }
      if (core_cost < money && core_ret < min_return_time)
      {
        [min_return_time, index, type] = [core_ret, i, 2];
      }

      ns.print(`${i}: \n\t${[level_inc, ram_inc, core_inc].map(n => ns.format.number(n).padEnd(30)).join('\t')}`
        + `\n\t${[level_cost, ram_cost, core_cost].map(n => ns.format.number(n).padEnd(30)).join('\t')}`
        + `\n\t${[level_ret*1000, ram_ret*1000, core_ret*1000].map(n => ns.format.time(n).padEnd(30)).join('\t')}`);
    }
    let purchased_something = min_return_time < return_time && index != -1;
    if (purchased_something)
    {
      switch(type)
      {
        case 0:
        {
          let cost = ns.hacknet.getLevelUpgradeCost(index);
          ns.hacknet.upgradeLevel(index);
          ns.print(`Upgraded level for node ${index} for ${cost.toLocaleString()}. Return time: ${ns.format.time(min_return_time*1000)}`);
          break;
        }
        case 1:
        {
          let cost = ns.hacknet.getRamUpgradeCost(index);
          ns.hacknet.upgradeRam(index);
          ns.print(`Upgraded RAM for node ${index} for ${cost.toLocaleString()}. Return time: ${ns.format.time(min_return_time*1000)}`);
          break;
        }
        case 2:
        {
          let cost = ns.hacknet.getCoreUpgradeCost(index);
          ns.hacknet.upgradeCore(index);
          ns.print(`Upgraded core for node ${index} for ${cost.toLocaleString()}. Return time: ${ns.format.time(min_return_time*1000)}`);
          break;
        }
      }
      purchased_something = true;
    }
    else {
      let node_cost = ns.hacknet.getPurchaseNodeCost();

      if (node_cost < (total_money_produced + total_money_spent)/2 && node_cost/total_production < return_time)
      {
        ns.print(`Purchased new node for ${node_cost.toLocaleString()}. Return time~: ${ns.format.time(node_cost/total_production)}`);
        purchased_something = true;
      }
    }

    ns.print(`Total money spent: ${ns.format.number(total_money_spent)}, Total money earned: ${ns.format.number(total_money_produced)}`
      + ` Total production: ${ns.format.number(total_production)}`)

    await ns.sleep(purchased_something ? 1000 : 60000);
  }
}