import '@/utility/extensions/array';
import { ConvertToFlagsData } from '@/utility/flags';
import { GangMemberInfo } from '@ns';

const flag_struct = {
  penalty_threshold: 0.25,
  wanted_threshold: 1,
  role_switch_threshold: 1.1,
  train_switch_threshold: 1.5,
  ascension_threshold: 1.5,
  augment_purchase_threshold: 0.01,
  equip_purchase_threshold: 0.001,
  clash_chance_threshold: 0.75,
};
const flags_data = ConvertToFlagsData(flag_struct);

export async function main(ns: NS) {
  ns.disableLog('gang.setMemberTask');
  ns.disableLog('gang.purchaseEquipment');
  ns.disableLog('gang.setTerritoryWarfare');

  const flags = ns.flags(flags_data) as typeof flag_struct;
  debugger;

  if (!ns.gang.inGang()) {
    ns.print('ERROR: Not in gang');
    return;
  }

  const taken_names = ns.gang.getMemberNames();
  let gangNames = [
    'Gregor',
    'Jason',
    'Steven',
    'Jessica',
    'Helga',
    'Martha',
    'Harry',
    'Berta',
    'Calcius',
    'Veronica',
    'Diana',
    'Joseph',
    'Jose',
    'Josephine',
    'Clara',
    'Frederico',
  ].filter((n) => !taken_names.includes(n));

  let clean_wanted = false;
  let clash = false;
  let reput_gang_member_name = '';
  let money_gang_member_name = '';
  let warfare_gang_member_name = '';

  while (true) {
    await ns.gang.nextUpdate();
    while (ns.gang.canRecruitMember()) {
      const chosen_name = gangNames.length ? gangNames.getrandom() : `Ganger_${gangNames.length}`;
      taken_names.push(chosen_name);
      gangNames = gangNames.filter((n) => n != chosen_name);
      ns.gang.recruitMember(chosen_name);
      ns.print(`Recruited ${chosen_name}`);
    }

    const equipment = ns.gang
      .getEquipmentNames()
      .map((e) => {
        return {
          name: e,
          cost: ns.gang.getEquipmentCost(e),
          stats: ns.gang.getEquipmentStats(e),
          type: ns.gang.getEquipmentType(e),
        };
      })
      .sortby((e) => e.cost);
    const gang_info = ns.gang.getGangInformation();
    let gang_members = ns.gang
      .getMemberNames()
      .map((n) => {
        const info = ns.gang.getMemberInformation(n);
        return {
          ...info,
          total_exp: info.hack_exp + info.agi_exp + info.def_exp + info.dex_exp + info.str_exp + info.cha_exp,
          total_stats: info.hack + info.agi + info.def + info.dex + info.str + info.cha,
        };
      })
      .sortby((m) => m.total_stats, false);
    if (gang_info.wantedPenalty < flags.penalty_threshold) clean_wanted = true;
    if (clean_wanted && gang_info.wantedLevel <= flags.wanted_threshold) clean_wanted = false;
    if (clean_wanted) {
      for (const member of gang_members) {
        ns.gang.setMemberTask(member.name, gang_info.isHacking ? 'Ethical Hacking' : 'Vigilante Justice');
      }
      continue;
    }

    let enemy_gangs = Object.entries(ns.gang.getAllGangInformation());
    enemy_gangs = enemy_gangs.filter((g) => g[0] != gang_info.faction && g[1].territory > 0);

    clash =
      enemy_gangs.length === 0 ||
      enemy_gangs.every((g) => ns.gang.getChanceToWinClash(g[0]) > flags.clash_chance_threshold);
    ns.gang.setTerritoryWarfare(clash);

    if (gang_members.length < 2) continue;
    const members_with_role = [];
    if (reput_gang_member_name === '') reput_gang_member_name = gang_members[0].name;
    let reput_gang_member = gang_members.find((m) => m.name === reput_gang_member_name) as Unpacked<
      typeof gang_members
    >;
    if (gang_members[0].total_stats >= reput_gang_member.total_stats * flags.role_switch_threshold) {
      ns.print(`Switching respect role ${reput_gang_member_name} -> ${gang_members[0].name}`);
      reput_gang_member = gang_members[0];
      reput_gang_member_name = gang_members[0].name;
    }
    members_with_role.push(reput_gang_member);
    gang_members = gang_members.filter((m) => m.name != reput_gang_member_name);

    if (money_gang_member_name === '') money_gang_member_name = gang_members[0].name;
    let money_gang_member = gang_members.find((m) => m.name === money_gang_member_name);
    if (gang_members[0].total_stats >= (money_gang_member?.total_stats ?? 0) * flags.role_switch_threshold) {
      ns.print(`Switching money role ${money_gang_member_name} -> ${gang_members[0].name}`);
      money_gang_member = gang_members[0];
      money_gang_member_name = gang_members[0].name;
    }
    members_with_role.push(money_gang_member);
    gang_members = gang_members.filter((m) => m.name != money_gang_member_name);
    if (gang_members.length > 1) {
      if (warfare_gang_member_name === '') warfare_gang_member_name = gang_members[0].name;
      let warfare_gang_member = gang_members.find((m) => m.name === warfare_gang_member_name);
      if (gang_members[0].total_stats >= (warfare_gang_member?.total_stats ?? 0) * flags.role_switch_threshold) {
        ns.print(`Switching warfare role ${warfare_gang_member_name} -> ${gang_members[0].name}`);
        warfare_gang_member = gang_members[0];
        warfare_gang_member_name = gang_members[0].name;
      }
      members_with_role.push(warfare_gang_member);
      gang_members = gang_members.filter((m) => m.name != warfare_gang_member_name);
    }

    gang_members.unshift(...members_with_role);

    for (let member of gang_members as GangMemberInfo[]) {
      const money = ns.getPlayer().money;
      for (const upgrade of equipment) {
        const is_aug = upgrade.type == 'Augmentation';
        if (upgrade.cost > money * (is_aug ? flags.augment_purchase_threshold : flags.equip_purchase_threshold)) break;
        if ((is_aug ? member.augmentations : member.upgrades).includes(upgrade.name)) continue;

        ns.gang.purchaseEquipment(member.name, upgrade.name);
      }

      if (member.name === reput_gang_member_name) {
        let max_rep_gain = 0;
        let max_rep_gain_task = '';

        for (const task of ns.gang.getTaskNames()) {
          const task_info = ns.gang.getTaskStats(task);
          const rep_gain = ns.formulas.gang.respectGain(gang_info, member, task_info);
          const wanted_gain = ns.formulas.gang.wantedLevelGain(gang_info, member, task_info);

          if (rep_gain - wanted_gain > max_rep_gain) {
            max_rep_gain = rep_gain - wanted_gain;
            max_rep_gain_task = task;
          }
        }

        if (max_rep_gain_task != '') {
          ns.gang.setMemberTask(member.name, max_rep_gain_task);
          continue;
        }
      } else if (member.name === money_gang_member_name) {
        let max_money_gain = 0;
        let max_money_gain_task = '';

        for (const task of ns.gang.getTaskNames()) {
          const task_info = ns.gang.getTaskStats(task);
          const rep_gain = ns.formulas.gang.respectGain(gang_info, member, task_info);
          const wanted_gain = ns.formulas.gang.wantedLevelGain(gang_info, member, task_info);
          const money_gain = ns.formulas.gang.moneyGain(gang_info, member, task_info);

          if (rep_gain - wanted_gain > 0 && money_gain > max_money_gain) {
            max_money_gain = rep_gain - wanted_gain;
            max_money_gain_task = task;
          }
        }

        if (max_money_gain_task != '') {
          ns.gang.setMemberTask(member.name, max_money_gain_task);
          continue;
        }
      } else if (clash || member.name === warfare_gang_member_name) {
        ns.gang.setMemberTask(member.name, 'Territory Warfare');
        continue;
      }

      if (member.earnedRespect < gang_info.respect / 2) {
        const ascension_increase = [
          ns.formulas.gang.ascensionMultiplier(
            member.hack_asc_points + ns.formulas.gang.ascensionPointsGain(member.hack_exp),
          ) / member.hack_asc_mult,
          ns.formulas.gang.ascensionMultiplier(
            member.str_asc_points + ns.formulas.gang.ascensionPointsGain(member.str_exp),
          ) / member.str_asc_mult,
          ns.formulas.gang.ascensionMultiplier(
            member.def_asc_points + ns.formulas.gang.ascensionPointsGain(member.def_exp),
          ) / member.def_asc_mult,
          ns.formulas.gang.ascensionMultiplier(
            member.dex_asc_points + ns.formulas.gang.ascensionPointsGain(member.dex_exp),
          ) / member.dex_asc_mult,
          ns.formulas.gang.ascensionMultiplier(
            member.agi_asc_points + ns.formulas.gang.ascensionPointsGain(member.agi_exp),
          ) / member.agi_asc_mult,
          ns.formulas.gang.ascensionMultiplier(
            member.cha_asc_points + ns.formulas.gang.ascensionPointsGain(member.cha_exp),
          ) / member.cha_asc_mult,
        ];
        if (ascension_increase.every((x) => x >= flags.ascension_threshold)) {
          gang_info.respect -= member.earnedRespect;
          ns.gang.ascendMember(member.name);
          member = ns.gang.getMemberInformation(member.name);
        }
      }

      const current_task = member.task;
      let next_task = current_task.startsWith('Train') ? current_task : 'Train Combat';

      const data = [
        {
          task: 'Train Hacking',
          exp: member.hack_exp,
        },
        {
          task: 'Train Combat',
          exp: Math.min(member.str_exp, member.def_exp, member.dex_exp, member.agi_exp),
        },
        {
          task: 'Train Charisma',
          exp: member.cha_exp,
        },
      ].sortby((t) => t.exp);

      if (current_task == data[2].task && data[2].exp > data[0].exp * flags.train_switch_threshold) {
        next_task = data[0].task;
      }

      ns.gang.setMemberTask(member.name, next_task);
    }
  }
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
  data.flags(flags_data);
  return ['--tail'];
}
