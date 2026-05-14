import { HackOperation } from "./network_packets";

export function ConvertToArgs(obj: any)
{
	let ret = [] as ScriptArg[]
	for (let key in obj)
	{
		if (obj[key] !== undefined)
		switch (typeof obj[key])
		{
			case "boolean":
				if (obj[key])
					ret.push(`--${key}`);
				break;
			case "string":
			case "number":
				ret.push(`--${key}`, obj[key]);
				break;
			case "object":
				if (obj[key].every((it: any) => typeof it == 'string'))
				{
					obj.forEach((it: string) => ret.push(`--${key}`, it));
					break;
				}
			default:
				throw `${typeof obj[key]} is not ScriptArg`;
		}
	}

	return ret;
}

export function ConvertToFlagsData(obj: any)
{
	let ret = [] as [string, any][]
	for (let key in obj)
	{
		if (obj[key] !== undefined)
		switch (typeof obj[key])
		{
			case "boolean":
			case "string":
			case "number":
				ret.push([key, obj[key]]);
				break;
			case "object":
				if (obj[key].every((it: any) => {return typeof it == 'string'}))
				{
					ret.push([key, obj[key]]);
					break
				}
			default:
				throw `${typeof obj[key]}(${obj[key]}) is not ScriptArg`;
		}
	}

	return ret;
}

export function ConvertArgsToFlags<T extends Object>(args: ScriptArg[], template: T):Partial<T>
{
	let obj: Partial<T> = {};
	for (let a_ind = 0; a_ind < args.length; ++a_ind)
	{
		if (typeof args[a_ind] == "string")
		{
			let str_arg = args[a_ind] as string;
			if (!str_arg.startsWith("--"))
				throw `Unexpected argument ${args[a_ind]}`;
			str_arg = str_arg.slice(2);
			if (Object.keys(template).some(k => k == str_arg))
			{
				let expected_arg_type = typeof (template as any)[str_arg];
				switch(expected_arg_type)
				{
					case "string":
					case "number":
					case "object":
						if (a_ind == args.length - 1 || typeof args[a_ind+1] != expected_arg_type)
							throw `Unexpected argument ${args[a_ind+1]}. ${expected_arg_type} was expected`;
						(obj as any)[str_arg] = args[a_ind+1];
						break;
					case "boolean":
						(obj as any)[str_arg] = true;
				}
			}
			else {
				throw `Unexpected argument ${args[a_ind]}`;
			}
			++a_ind;
		}
	}
	return obj;
}

export namespace Contract
{
	export namespace Solver{
		export type TypeSolverArgs = {
			type: CodingContractName 
		}
		export type FileSolverArgs = TypeSolverArgs & {
			filename: string,
			hostname: string
		}
	}
}

export namespace Hacking {
	export type HackArgs = {
		target: string,
		log_file: string,
		port_index: number,
		log_prefix: string,
	}

	export type HackFinishAtArgs = HackArgs & {
		finish_at: number,
		process_time: number
	}

	export type HackRunAtArgs = HackArgs & {
		run_at: number,
	}

	export type HackDelayArgs = HackArgs & {
		delay: number,
	}

	export type HackDelayUniArgs = HackDelayArgs & {
		operation: HackOperation,
	}
}