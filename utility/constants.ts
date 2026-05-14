export const PortNumbers = {
  multi_hack_in: 1,
  probe_controller_in: 2,
  contract_scanner_in: 3,
};

export const ScriptNames = {
  constants: '/scripts/utility/constants.js',
  constract_solver: '/scripts/contract/solver.js',
  prober: '/scripts/darknet/prober.js',
  crack_password: '/scripts/darknet/crack_password.js',
  memory_reallocation: '/scripts/darknet/simple/memoryReallocation.js',
  open_chache: '/scripts/darknet/simple/openCache.js',
  phishing_attack: '/scripts/darknet/simple/phishingAttack.js',
  induce_server_migration: '/scripts/darknet/simple/induceServerMigration.js',
  logger: '/scripts/utility/log.js',
  network_packets: '/scripts/utility/network_packets.js',
  hack_script: '/scripts/hacking/simple/hack.js',
  grow_script: '/scripts/hacking/simple/grow.js',
  weaken_script: '/scripts/hacking/simple/weaken.js',
  hwg_script: '/scripts/hacking/simple/hwg_uni.js',
  flags: '/scripts/utility/flags.js',
};

export const FileNames = {
  password_database: '/data/passwords.json',
};

export const ProberScripts = [
  ScriptNames.constants,
  ScriptNames.prober,
  ScriptNames.crack_password,
  ScriptNames.memory_reallocation,
  ScriptNames.open_chache,
  ScriptNames.phishing_attack,
  ScriptNames.induce_server_migration,
  ScriptNames.logger,
  ScriptNames.network_packets,
];

export const HackScripts = [
  ScriptNames.hack_script,
  ScriptNames.grow_script,
  ScriptNames.weaken_script,
  ScriptNames.hwg_script,
  ScriptNames.logger,
  ScriptNames.constants,
  ScriptNames.network_packets,
  ScriptNames.flags,
];

export const Strings = {
  null_port_data: 'NULL PORT DATA',
};
