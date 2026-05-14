export const PacketType = {
  new_password: 'new_password',
  request_password: 'request_password',
  request_password_response: 'request_password_response',
  darknet_contract: 'darknet_contract',
  contract_solve_result: 'contract_solve_result',
  hack_operation_result: 'hack_operation_result',
};

export class NetworkPacket {
  constructor(type: string) {
    this.type = type;
  }
  type: string;
}

export class NewPasswordPacket extends NetworkPacket {
  constructor(hostname: string, modelId: string, password: string, source: string) {
    super(PacketType.new_password);
    [this.hostname, this.modelId, this.password, this.source] = [hostname, modelId, password, source];
  }
  password: string;
  hostname: string;
  modelId: string;
  source: string;
}

export class RequestPasswordPacket extends NetworkPacket {
  constructor(hostname: string, modeilId: string, pid: number) {
    super(PacketType.request_password);
    [this.hostname, this.modelId, this.pid] = [hostname, modeilId, pid];
  }
  hostname: string;
  modelId: string;
  pid: number;
}

export class RequestPasswordResponse extends NetworkPacket {
  constructor(hostname: string, password: string | undefined) {
    super(PacketType.request_password_response);
    [this.hostname, this.password] = [hostname, password];
  }
  hostname: string;
  password: string | undefined;
}

export class DarknetContractReportPacket extends NetworkPacket {
  constructor(server: string, file: string) {
    super(PacketType.darknet_contract);
    this.server = server;
    this.file = file;
  }
  server: string;
  file: string;
}

export class ContractSolveResultPacket extends NetworkPacket {
  constructor(ctype: CodingContractName, server: string, file: string, reward: string, pid: number) {
    super(PacketType.contract_solve_result);
    this.ctype = ctype;
    this.server = server;
    this.file = file;
    this.reward = reward;
    this.pid = pid;
  }
  ctype: CodingContractName;
  server: string;
  file: string;
  reward: string;
  pid: number;
}

export type HackOperation = 'hack' | 'grow' | 'weaken';
export class HackOperationResultPacket extends NetworkPacket {
  constructor(target: string, result: number, operation: HackOperation, pid: number) {
    super(PacketType.hack_operation_result);
    this.target = target;
    this.result = result;
    this.operation = operation;
    this.pid = pid;
  }
  target: string;
  operation: HackOperation;
  result: number;
  pid: number;
}
