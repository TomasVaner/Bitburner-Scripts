import { HackOperation } from './network_packets';

export function ConvertToArgs(obj: any) {
  const ret = [] as ScriptArg[];
  for (const key in obj) {
    if (obj[key] !== undefined) {
      // noinspection FallThroughInSwitchStatementJS
      switch (typeof obj[key]) {
        case 'boolean':
          if (obj[key]) ret.push(`--${key}`);
          break;
        case 'string':
        case 'number':
          ret.push(`--${key}`, obj[key]);
          break;
        case 'object':
          if (obj[key].every((it: unknown) => typeof it == 'string')) {
            obj[key].forEach((it: string) => ret.push(`--${key}`, it));
            break;
          }
          throw `${typeof obj[key]} is not ScriptArg`;
        default:
          throw `${typeof obj[key]} is not ScriptArg`;
      }
    }
  }

  return ret;
}

export function ConvertToFlagsData(obj: any) {
  const ret = [] as [string, ScriptArg | string[]][];
  for (const key in obj) {
    if (obj[key] !== undefined)
      switch (typeof obj[key]) {
        case 'boolean':
        case 'string':
        case 'number':
          ret.push([key, obj[key]]);
          break;
        case 'object':
          if (
            obj[key].every((it: unknown) => {
              return typeof it == 'string';
            })
          ) {
            ret.push([key, obj[key]]);
            break;
          }
        default:
          throw `${typeof obj[key]}(${obj[key]}) is not ScriptArg`;
      }
  }

  return ret;
}

export function ConvertArgsToFlags<T extends object>(args: ScriptArg[], template: T): Partial<T> {
  const obj: Partial<T> = {};
  for (let a_ind = 0; a_ind < args.length; ++a_ind) {
    if (typeof args[a_ind] == 'string') {
      let str_arg = args[a_ind] as string;
      if (!str_arg.startsWith('--')) throw `Unexpected argument ${args[a_ind]}`;
      str_arg = str_arg.slice(2);
      if (Object.keys(template).some((k) => k == str_arg)) {
        const expected_arg_type = typeof (template as any)[str_arg];
        switch (expected_arg_type) {
          case 'string':
          case 'number':
          case 'object':
            if (a_ind == args.length - 1 || typeof args[a_ind + 1] != expected_arg_type)
              throw `Unexpected argument ${args[a_ind + 1]}. ${expected_arg_type} was expected`;
            (obj as any)[str_arg] = args[a_ind + 1];
            break;
          case 'boolean':
            (obj as any)[str_arg] = true;
        }
      } else {
        throw `Unexpected argument ${args[a_ind]}`;
      }
      ++a_ind;
    }
  }
  return obj;
}

export function GetLastArgument(data: AutocompleteData, args: ScriptArg[]) {
  return args.filter((arg) => typeof arg == 'string' && arg?.startsWith('--')).at(-1);
}

export namespace Contract {
  export namespace Solver {
    export type TypeSolverArgs = {
      type: CodingContractName;
    };
    export type FileSolverArgs = TypeSolverArgs & {
      filename: string;
      hostname: string;
    };
  }
}

export namespace Hacking {
  export type HackArgs = {
    target: string;
    log_file: string;
    port_index: number;
    log_prefix: string;
    compute_server: string;
  };

  export type HackFinishAtArgs = HackArgs & {
    finish_at: number;
    process_time: number;
  };

  export type HackRunAtArgs = HackArgs & {
    run_at: number;
  };

  export type HackDelayArgs = HackArgs & {
    delay: number;
    operation: HackOperation;
  };
}
