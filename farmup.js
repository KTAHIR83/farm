const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const token = process.env.token;

const requestToken = process.env.requestToken; // new CSRF / request token
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const api = axios.create({
  baseURL: "https://chainers.io/api/farm",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "Origin": "https://static.chainers.io",
    "Referer": "https://static.chainers.io/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    "x-request-token-id": requestToken,
  },
});
// 🌱 Seed array with growth times


const plantSeed = [
{"userGardensIDs":"68c44690637b77c0d1b5b4a2","userBedsIDs":"697e64eaa9faa90b32826be8","seedIDs":"673e0c942c7bfd708b352471", "growthTime":204000},
{"userGardensIDs":"68c44690637b77c0d1b5b4a2","userBedsIDs":"6915f6f77cb94076342bd593","seedIDs":"673e0c942c7bfd708b352453","growthTime":102000},
{"userGardensIDs":"68c44690637b77c0d1b5b4a2","userBedsIDs":"692dec45337dbc729f38df46","seedIDs":"67dc227a59b878f195998d82","growthTime":19680000},
{"userGardensIDs":"68c44690637b77c0d1b5b4a2","userBedsIDs":"694ce641cc638d10d0cfff26","seedIDs":"68824771915623f3dcc1fb09","growthTime":21600000},
{"userGardensIDs":"68c44690637b77c0d1b5b4a2","userBedsIDs":"6988400d556d7e8405003f89","seedIDs":"67dc227a59b878f195998dbe","growthTime":1920000},
{"userGardensIDs":"68c44690637b77c0d1b5b4a2","userBedsIDs":"6995a6968ad9511bb192f9cd","seedIDs":"67dc227a59b878f195998e12","growthTime":10860000},
{"userGardensIDs":"68c44690637b77c0d1b5b4a2","userBedsIDs":"6950dc23868cd847c6565feb","seedIDs":"673e0c942c7bfd708b352489","growthTime":6720000},
{"userGardensIDs":"68c44690637b77c0d1b5b4a2","userBedsIDs":"692effaed527961009852539","seedIDs":"67dc227a59b878f195998ee4","growthTime":5400000},
{"userGardensIDs":"68c44690637b77c0d1b5b4a2","userBedsIDs":"6964c430e599080a0d21adc1","seedIDs":"683dbe2ba9ec974575a4bedc","growthTime":3000000},
{"userGardensIDs":"68c44690637b77c0d1b5b4a2","userBedsIDs":"6931dea3dff2bc7ba99a41e7","seedIDs":"67dc227a59b878f195998df4","growthTime":3780000},
{"userGardensIDs":"68c44690637b77c0d1b5b4a2","userBedsIDs":"695a45be719270eea4787e67","seedIDs":"694412e2506616961d8cc890","growthTime": 18000000},
 {"userGardensIDs":"68c44690637b77c0d1b5b4a2","userBedsIDs":"69501244dd8717ea6c810adc","seedIDs":"694412e2506616961d8cc890","growthTime": 18000000},
 
];



// 📊 Dashboard tracker
const bedStatus = new Map();
function showDashboard() {
  console.clear();
  console.log("🌾 CHAINERS FARM DASHBOARD 🌾");
  console.log("BED ID\t\t\tSEED ID\t\tREMAINING\tSTATUS");
  console.log("---------------------------------------------------------------");

  for (const [bedId, info] of bedStatus.entries()) {
    const remaining = info.remaining > 0 ? `${Math.floor(info.remaining / 1000)}s` : "0s";
    console.log(`${bedId}\t${info.seedId}\t${remaining}\t${info.status}`);
  }

  console.log("---------------------------------------------------------------");
  console.log("🕒 Updated:", new Date().toLocaleTimeString());
}

// 🚜 Harvest crop
async function harvestCrop(userFarmingID) {
  try {
    await api.post("/control/collect-harvest", {
        "userFarmingID": userFarmingID
    },);
    console.log(`✅ Harvested crop ${userFarmingID}`);
    return true;
  } catch (err) {
    console.error(`❌ Harvest failed for ${userFarmingID}:`, err.message);
    return false;
  }
}

// 🌱 Plant seed
async function plantSeedFunc(gardenId, bedId, seedId) {
  try {
    const res = await api.post("/control/plant-seed", {
      userGardensID: gardenId,
      userBedsID: bedId,
      seedID: seedId,
    });
    const userFarmingID = res.data?.data?.userFarmingID;
    console.log(`🌱 Planted seed ${seedId} on bed ${bedId} (farmID: ${userFarmingID})`);
    return userFarmingID;
  } catch (err) {
    console.error(`❌ Plant failed on bed ${bedId}: ${err.message}`);
    return null;
  }
}

// 🧩 Fetch all gardens
async function getGardens() {
  try {
    const res = await api.get("/user/gardens");
    return res.data.data || [];
  } catch (err) {
    console.error("❌ Error fetching gardens:", err.message);
    return [];
  }
}

// 🔁 Bed cycle: harvest if ready, else plant if empty
async function bedCycle(seedInfo) {
  const { userGardensIDs, userBedsIDs, seedIDs, growthTime } = seedInfo;
  let plantedAt = null;
  let userFarmingID = null;

  while (true) {
    // Check garden for existing planted seed
    const gardens = await getGardens();
    const garden = gardens.find(g => g.userGardensID === userGardensIDs);
    const bed = garden?.placedBeds?.find(b => b.userBedsID === userBedsIDs);

    if (bed?.plantedSeed) {
      userFarmingID = bed.plantedSeed.userFarmingID;
      plantedAt = new Date(bed.plantedSeed.plantedDate).getTime();
    }

    // If planted, check growth
    const now = Date.now();
    if (userFarmingID && plantedAt) {
      const elapsed = now - plantedAt;
      const remaining = growthTime - elapsed;

      bedStatus.set(userBedsIDs, {
        seedId: seedIDs,
        remaining: remaining > 0 ? remaining : 0,
        status: remaining > 0 ? "🌱 Growing" : "🌾 Ready to harvest",
      });

      if (remaining <= 0) {
        const harvested = await harvestCrop(userFarmingID);
        if (harvested) {
          await wait(20000); // 10s before replant
          userFarmingID = await plantSeedFunc(userGardensIDs, userBedsIDs, seedIDs);
          plantedAt = Date.now();
          bedStatus.set(userBedsIDs, {
            seedId: seedIDs,
            remaining: growthTime,
            status: "🌱 Replanted",
          });
        }
      }
    } else {
      // If not planted, plant
      await wait(20000); 
      userFarmingID = await plantSeedFunc(userGardensIDs, userBedsIDs, seedIDs);
      if (userFarmingID) plantedAt = Date.now();
      bedStatus.set(userBedsIDs, {
        seedId: seedIDs,
        remaining: growthTime,
        status: userFarmingID ? "🌱 Planted" : "⚠️ Plant failed",
      });
    }

    await wait(20000); // check every 5s
  }
}

// 🚀 Start farm
async function startFarm() {
  console.log("🌾 Starting Chainers farm automation...");

  // Start dashboard
  setInterval(showDashboard, 25000);

  // Start parallel bed cycles
  for (const seedInfo of plantSeed) {
    bedCycle(seedInfo);
    await wait(20000); // stagger bed starts to reduce rate-limit
  }
}

startFarm().catch(err => console.error("💥 Fatal error:", err.message));








