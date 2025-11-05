// beer-opcua.js
// npm i node-opcua
const {
  OPCUAClient,
  AttributeIds,
  MessageSecurityMode,
  SecurityPolicy,
  ClientSubscription,
  ClientMonitoredItem,
  TimestampsToReturn,
  DataType,
} = require("node-opcua");

// --- OPC UA endpoint + login ---
const endpointUrl = "opc.tcp://127.0.0.1:4840";
const username = "sdu";
const password = "1234";

// --- NodeIds fra UaExpert (tilpas hvis dine er anderledes) ---
const NODE_STATE_CURRENT   = "ns=6;s=::Program:Cube.Status.StateCurrent";
const NODE_CNTRLCMD        = "ns=6;s=::Program:Cube.Command.CntrlCmd";
const NODE_CMDCHANGEREQ    = "ns=6;s=::Program:Cube.Command.CmdChangeRequest";

// (valgfrit) flere noder du måske får brug for
// const NODE_MACH_SPEED   = "ns=6;s=::Program:Cube.Command.MachSpeed";
// const NODE_PARAM0       = "ns=6;s=::Program:Cube.Command.Parameter[0]"; // BatchId
// const NODE_PARAM1       = "ns=6;s=::Program:Cube.Command.Parameter[1]"; // ProductId
// const NODE_PARAM2       = "ns=6;s=::Program:Cube.Command.Parameter[2]"; // Amount

const packML = {
  0: "Idle", 1: "Starting", 2: "Execute (kører)", 3: "Completing", 4: "Complete",
  5: "Stopping", 6: "Stopped", 7: "Aborting", 8: "Aborted", 9: "Resetting",
  10: "Clearing", 11: "Suspending", 12: "Suspended", 13: "Unsuspending",
  14: "Holding", 15: "Held", 16: "Unholding", 17: "Changing Mode",
};

// Map brugervenlige kommando-navne → PackML tal
const CMD = { Reset: 1, Start: 2, Stop: 3, Abort: 4, Clear: 5 };

// Læs ønsket kommando fra env (fx CMD=Start) eller default: Start
const desiredCmdName = (process.env.CMD || "Start").trim();
const desiredCmd = CMD[desiredCmdName];

if (!desiredCmd) {
  console.log("Brug CMD=Reset|Start|Stop|Abort|Clear når du kører scriptet.");
  console.log("Eksempel: CMD=Reset node beer-opcua.js");
}

(async () => {
  const client = OPCUAClient.create({
    endpointMustExist: false,
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    requestedSessionTimeout: 60_000,
  });

  try {
    console.log("Forbinder til", endpointUrl);
    await client.connect(endpointUrl);
    const session = await client.createSession({ userName: username, password: password });
    console.log("Session oprettet!");

    // --- Live monitor på StateCurrent ---
    const sub = ClientSubscription.create(session, { requestedPublishingInterval: 500, publishingEnabled: true });
    const mon = ClientMonitoredItem.create(
      sub,
      { nodeId: NODE_STATE_CURRENT, attributeId: AttributeIds.Value },
      { samplingInterval: 250, queueSize: 10, discardOldest: true },
      TimestampsToReturn.Both
    );
    mon.on("changed", dv => {
      const v = dv.value?.value;
      console.log("Status:", v, "-", packML[v] || "Ukendt");
    });

    // Læs initial status
    const dv0 = await session.read({ nodeId: NODE_STATE_CURRENT, attributeId: AttributeIds.Value });
    console.log("Initial status:", dv0.value?.value, "-", packML[dv0.value?.value] || "Ukendt");

    // --- Helper til skrivning ---
    async function writeInt(nodeId, value) {
      await session.write({
        nodeId,
        attributeId: AttributeIds.Value,
        value: { value: { dataType: DataType.Int32, value } },
      });
    }
    async function writeBool(nodeId, value) {
      await session.write({
        nodeId,
        attributeId: AttributeIds.Value,
        value: { value: { dataType: DataType.Boolean, value } },
      });
    }

    // --- Send PackML kommando ---
    async function sendPackML(cmdNumber) {
      console.log(`Sender PackML kommando ${cmdNumber} (${Object.keys(CMD).find(k=>CMD[k]===cmdNumber)})`);
      await writeInt(NODE_CNTRLCMD, cmdNumber);
      await writeBool(NODE_CMDCHANGEREQ, true);
      // et kort "pulse" er nok; nogle servere kræver et lille delay
      await new Promise(r => setTimeout(r, 50));
      await writeBool(NODE_CMDCHANGEREQ, false);
    }

    if (desiredCmd) {
      // typisk sekvens hvis du kommer fra Aborted el. Stopped:
      if (desiredCmdName === "Start") {
        // Reset → Start er ofte nødvendigt hvis der har været fault/abort
        if ((dv0.value?.value === 8) || (dv0.value?.value === 6)) {
          await sendPackML(CMD.Reset);
        }
      }
      await sendPackML(desiredCmd);
    }

    console.log("Lytter på status-ændringer... (Ctrl+C for at stoppe)");
    // hold processen kørende
    // eslint-disable-next-line no-constant-condition
    while (true) { await new Promise(r => setTimeout(r, 1000)); }

  } catch (err) {
    console.error("Fejl:", err.message || err);
    try { await client.disconnect(); } catch {}
    process.exit(1);
  }
})();