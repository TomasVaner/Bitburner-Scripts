export function ProgressBar(props: { startTime: number; endTime: number; ns: NS }) {
  const [bgcolor, setbgcolor] = React.useState('#ff0000');
  const start = props.startTime;
  const end = props.endTime;
  let [complete, setcomplete] = React.useState(0);
  const ns = props.ns;
  // cancelled prevents setState calls after unmount, which would cause warnings
  // or leave background polling running after the UI is gone
  let [cancelled, setcanceled] = React.useState(false);
  // We keep the timer id so we can cancel the scheduled refresh during cleanup
  let timer: ReturnType<typeof setTimeout>;
  //let [current, setcurrent] = React.useState(performance.now())

  //use an effect here to update your state

  // This effect starts the live refresh loop for the UI
  // It runs once for this ns instance, then keeps polling game state on a timer

  function setSnapshot() {
    const duration = end - start;
    //ns.print((performance.now() - start) / (end-start) * 100)
    if (complete >= 100 || complete < 0) {
      cancelled = true;
      setcanceled(true);
    }
    complete = Math.min(((performance.now() - start) / duration) * 100, 100);
    setcomplete(complete);
    calcColor();
  }

  function calcColor() {
    const red = Math.round(255 * (1 - complete / 100));
    const green = Math.round((255 * complete) / 100);
    //console.log(red)
    //console.log(green)
    setbgcolor('#' + red.toString(16) + green.toString(16) + '00');
  }

  React.useEffect(() => {
    // tick performs one full state refresh cycle:
    // 1. read live game/script state
    // 2. push it into React state
    // 3. schedule the next refresh
    const tick = async () => {
      // Build one immutable snapshot of everything the UI needs right now
      //const next = await buildSnapshot(ns)
      // Only update React state if the component is still mounted
      // This rerender is what makes the UI visually update
      if (!cancelled) setSnapshot();
      // Schedule the next polling pass. Using setTimeout instead of setInterval
      // avoids overlapping refreshes if a snapshot read takes longer than expected
      if (!cancelled) timer = setTimeout(tick, 200);
    };
    // Start the polling loop immediately when the component mounts.  No await so it's async in the background
    void tick();
    // Cleanup runs when the component unmounts or if ns ever changes
    // It stops future rerenders and cancels the pending timer
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // The effect only depends on ns, so it behaves like "mount once per script instance"
  }, [ns]);

  const containerStyles = {
    height: 47,
    width: '100%',
    backgroundColor: '#0f0f0f',
    borderRadius: 0,
    margin: 0,
  };

  const fillerStyles = {
    height: '100%',
    width: `${complete}%`,
    backgroundColor: bgcolor,
    borderRadius: 'inherit',
    textAlign: 'center' as const,
  };

  const labelStyles = {
    padding: 0,
    'font-size': '30px',
    'font-weight': '1000',
    'text-shadow': '-2px -2px 0px #000, 2px -2px 0px #000, -2px  2px 0px #000, 2px  2px 0px #000',
    color: '#00ffffff',
    'white-space': 'nowrap',
  };

  if (!cancelled) {
    return (
      <div style={containerStyles}>
        <div style={fillerStyles}>
          <span style={labelStyles}>{`${Math.round(complete)}% ${
            complete < 100 ? `(${((end - performance.now()) / 1000).toFixed(2)}s left)` : ``
          }`}</span>
        </div>
      </div>
    );
  } else return <></>;
}
