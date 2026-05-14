export class Logger {
  constructor(ns:NS, {log_file="", clean=true, extra_name = "", create_file = true} = {}) {
    this.log_file = log_file;
    if (this.log_file.length == 0 && create_file)
      this.log_file = `/logs/${ns.getScriptName()}${extra_name ? '/' + extra_name : ''}/${ns.pid}.txt`;
    
    this.ns = ns;
    if (clean)
    if (this.log_file)
    {
      try {
        ns.clear(this.log_file);
      } catch(_) {};
    }
    ns.print(`log_file: ${this.log_file}`);
    if (this.log_file)
      ns.atExit(() => {ns.print(`Log file: ${this.log_file}`)}, "log_file");
  }

  public log_file:string;
  ns:NS;
  prefix="";
  include_timestamp = false;
  logger_enabled = true;
  
  Log(message:string, {file=true, global_log=false, include_timestamp = undefined as boolean|undefined} = {})
  {
    if (!this.logger_enabled)
      return;
    if (include_timestamp === undefined)
      include_timestamp = this.include_timestamp;
    let ts = include_timestamp?`[${performance.now().toFixed(1)}] `:'';
    this.ns.print(`${this.prefix}${ts}${message}`);
    if (global_log)
      this.ns.tprint(`${this.prefix}${ts}${message}`);
    if (file && this.log_file)
      this.ns.write(this.log_file, `${this.prefix}${ts}${message}\n`, 'a');
  }
}