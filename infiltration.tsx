import { InfiltrationLocation } from "../NetscriptDefinitions";

export async function main(ns: NS) {
	ns.clearLog();
  let infiltrations = [] as InfiltrationLocation[]
  let locations = ns.infiltration.getPossibleLocations();
  for (let loc of locations)
  {
    infiltrations.push(ns.infiltration.getInfiltration(loc.name));
  }

  infiltrations.sort((i1, i2) => i1.difficulty - i2.difficulty);
  for (let inf of infiltrations)
  {
    ns.print(`${inf.location.city}/${inf.location.name}: \n\tdifficulty:${inf.difficulty}, max clearance:${inf.maxClearanceLevel}, start sec:${inf.startingSecurityLevel},\n\treward:${JSON.stringify(inf.reward)}`);
  }
}
