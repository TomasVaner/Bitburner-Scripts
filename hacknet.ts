export async function main(ns: NS) {
  const [return_time = 3600] = ns.args as [number];
  debugger;
  ns.tprint(`Nodes: ${ns.hacknet.numNodes()}/${ns.hacknet.maxNumNodes()}. Return time: ${return_time}`);
  //ns.tprint(`Multipliers: ${mults.production}, ${mults.purchaseCost} ${mults.levelCost},${mults.ramCost},${mults.coreCost}`)
  while (true) {
    let total_production = 0;
    const mults = ns.getHacknetMultipliers();
    const formulas = ns.fileExists('Formulas.exe');
    let [min_return_time, index, type] = [Infinity, -1, -1];
    const hack_nets = ns.hacknet.numNodes();
    const money = ns.getPlayer().money;

    const total_money_produced = ns.getMoneySources().sinceInstall.hacknet;
    const total_money_spent = ns.getMoneySources().sinceInstall.hacknet_expenses;

    const max_level = {
      level: 0,
      ram: 0,
      cores: 0,
    };

    for (let i = 0; i < hack_nets; ++i) {
      let [level_inc, ram_inc, core_inc] = [1.5 * mults.production, 0.01, 0.01];

      const hack_net = ns.hacknet.getNodeStats(i);
      total_production += hack_net.production;

      if (formulas) {
        level_inc =
          ns.formulas.hacknetNodes.moneyGainRate(hack_net.level + 1, hack_net.ram, hack_net.cores, mults.production) -
          hack_net.production;
        ram_inc =
          ns.formulas.hacknetNodes.moneyGainRate(hack_net.level, hack_net.ram * 2, hack_net.cores, mults.production) -
          hack_net.production;
        core_inc =
          ns.formulas.hacknetNodes.moneyGainRate(hack_net.level, hack_net.ram, hack_net.cores + 1, mults.production) -
          hack_net.production;
      }
      const level_cost = ns.hacknet.getLevelUpgradeCost(i);
      const ram_cost = ns.hacknet.getRamUpgradeCost(i);
      const core_cost = ns.hacknet.getCoreUpgradeCost(i);

      max_level.level = Math.max(max_level.level, hack_net.level);
      max_level.ram = Math.max(max_level.ram, hack_net.ram);
      max_level.cores = Math.max(max_level.cores, hack_net.cores);

      const [level_ret, ram_ret, core_ret] = [level_cost / level_inc, ram_cost / ram_inc, core_cost / core_inc];
      if (level_cost < money && level_ret < min_return_time) {
        [min_return_time, index, type] = [level_ret, i, 0];
      }
      if (ram_cost < money && ram_ret < min_return_time) {
        [min_return_time, index, type] = [ram_ret, i, 1];
      }
      if (core_cost < money && core_ret < min_return_time) {
        [min_return_time, index, type] = [core_ret, i, 2];
      }

      ns.print(
        `${i}: \n\t${[level_inc, ram_inc, core_inc].map((n) => ns.format.number(n).padEnd(30)).join('\t')}` +
          `\n\t${[level_cost, ram_cost, core_cost].map((n) => ns.format.number(n).padEnd(30)).join('\t')}` +
          `\n\t${[level_ret * 1000, ram_ret * 1000, core_ret * 1000]
            .map((n) => ns.format.time(n).padEnd(30))
            .join('\t')}`,
      );
    }

    if (formulas) {
      const node_upgrade_cost =
        ns.formulas.hacknetNodes.levelUpgradeCost(1, max_level.level - 1, mults.levelCost) +
        ns.formulas.hacknetNodes.ramUpgradeCost(1, Math.log2(max_level.ram) - 1, mults.ramCost) +
        ns.formulas.hacknetNodes.coreUpgradeCost(1, max_level.cores - 1, mults.coreCost);

      const new_node_income = ns.formulas.hacknetNodes.moneyGainRate(
        max_level.level,
        max_level.ram,
        max_level.cores,
        mults.production,
      );
      const new_node_return_time = (node_upgrade_cost + ns.hacknet.getPurchaseNodeCost()) / new_node_income;
      if (node_upgrade_cost < money && new_node_return_time < min_return_time) {
        [min_return_time, index, type] = [new_node_return_time, hack_nets, -1];
      }
      ns.print(
        `new:` +
          `\n\t${ns.format.number(new_node_income)}` +
          `\n\t${ns.format.number(node_upgrade_cost + ns.hacknet.getPurchaseNodeCost())}` +
          `\n\t${ns.format.time(new_node_return_time * 1000)}`,
      );
    }

    let purchased_something = min_return_time < return_time && index != -1;
    if (purchased_something) {
      switch (type) {
        case -1: {
          ns.hacknet.purchaseNode();
          ns.print(
            `Purchased new node for ${ns.hacknet.getPurchaseNodeCost().toLocaleString()}. Return time: ${ns.format.time(
              min_return_time * 1000,
            )}`,
          );
          break;
        }
        case 0: {
          const cost = ns.hacknet.getLevelUpgradeCost(index);
          ns.hacknet.upgradeLevel(index);
          ns.print(
            `Upgraded level for node ${index} for ${cost.toLocaleString()}. Return time: ${ns.format.time(
              min_return_time * 1000,
            )}`,
          );
          break;
        }
        case 1: {
          const cost = ns.hacknet.getRamUpgradeCost(index);
          ns.hacknet.upgradeRam(index);
          ns.print(
            `Upgraded RAM for node ${index} for ${cost.toLocaleString()}. Return time: ${ns.format.time(
              min_return_time * 1000,
            )}`,
          );
          break;
        }
        case 2: {
          const cost = ns.hacknet.getCoreUpgradeCost(index);
          ns.hacknet.upgradeCore(index);
          ns.print(
            `Upgraded core for node ${index} for ${cost.toLocaleString()}. Return time: ${ns.format.time(
              min_return_time * 1000,
            )}`,
          );
          break;
        }
      }
      purchased_something = true;
    } else {
      const node_cost = ns.hacknet.getPurchaseNodeCost();

      if (
        (node_cost < (total_money_produced + total_money_spent) / 2 && node_cost / total_production < return_time) ||
        (node_cost < money && hack_nets === 0)
      ) {
        ns.print(
          `Purchased new node for ${node_cost.toLocaleString()}. Return time~: ${ns.format.time(
            node_cost / total_production,
          )}`,
        );
        ns.hacknet.purchaseNode();
        purchased_something = true;
      }
    }

    ns.print(
      `Total money spent: ${ns.format.number(total_money_spent)}, Total money earned: ${ns.format.number(
        total_money_produced,
      )}` + ` Total production: ${ns.format.number(total_production)}`,
    );

    await ns.sleep(purchased_something ? 1000 : 60000);
  }
}
