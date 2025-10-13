const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const token = process.env.token;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const api = axios.create({
  baseURL: "https://chainers.io/api/farm",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
});

// 🌱 Seed array with growth times
const plantSeed = [
    { userGardensIDs: "68c2eb6a7e204da0fe55f668", userBedsIDs: "68c66ec9637b77c0d1f5ac2f", seedIDs: "673e0c942c7bfd708b352441", growthTime: 120000 },
    { userGardensIDs: "68c2eb6a7e204da0fe55f668", userBedsIDs: "68c2eb6a7e204da0fe55f664", seedIDs: "673e0c942c7bfd708b352447", growthTime: 180000 },
    { userGardensIDs: "68c2eb6a7e204da0fe55f668", userBedsIDs: "68c2ed1e5c457c186fbcf096", seedIDs: "673e0c942c7bfd708b352441", growthTime: 150000 },
    { userGardensIDs: "68c2eb6a7e204da0fe55f668", userBedsIDs: "68c7b8915c457c186fd40041", seedIDs: "665f2698534176fcd32f9a7d", growthTime: 1800000 },
    { userGardensIDs: "68c2eb6a7e204da0fe55f668", userBedsIDs: "68dd8aa03bdf0c6e7893f901", seedIDs: "67dc227a59b878f195998d8e", growthTime: 780000 },
    { userGardensIDs: "68c2eb6a7e204da0fe55f668", userBedsIDs: "68dd8aa03bdf0c6e7893f8ed", seedIDs: "665f2698534176fcd32f9a7d", growthTime: 1800000 },
    { userGardensIDs: "68c2eb6a7e204da0fe55f668", userBedsIDs: "68dd8aa03bdf0c6e7893f8f5", seedIDs: "67dc227a59b878f195998e7e", growthTime: 480000 },
    { userGardensIDs: "68c2eb6a7e204da0fe55f668", userBedsIDs: "68dd8aa03bdf0c6e7893f8fd", seedIDs: "673e0c942c7bfd708b35245f", growthTime: 240000 },
    { userGardensIDs: "68c2eb6a7e204da0fe55f668", userBedsIDs: "68dd8aa03bdf0c6e7893f8f1", seedIDs: "673e0c942c7bfd708b352405", growthTime: 360000 },
    { userGardensIDs: "68c2eb6a7e204da0fe55f668", userBedsIDs: "68dd8aa03bdf0c6e7893f8f9", seedIDs: "673e0c942c7bfd708b35245f", growthTime: 240000 },
    { userGardensIDs: "68c2eb6a7e204da0fe55f668", userBedsIDs: "68df7531bd36593b8b5ec737", seedIDs: "67dc227a59b878f195998dca", growthTime: 900000 },
    { userGardensIDs: "68c2eb6a7e204da0fe55f668", userBedsIDs: "68e0ba678e6f03b23d39fc6a", seedIDs: "673e0c942c7bfd708b352465", growthTime: 240000 },
    { userGardensIDs: "68c2eb6a7e204da0fe55f668", userBedsIDs: "68ec992d3464f6e70728af15", seedIDs: "67dc227a59b878f195998d8e", growthTime: 780000 }
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
          await wait(10000); // 10s before replant
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
      userFarmingID = await plantSeedFunc(userGardensIDs, userBedsIDs, seedIDs);
      if (userFarmingID) plantedAt = Date.now();
      bedStatus.set(userBedsIDs, {
        seedId: seedIDs,
        remaining: growthTime,
        status: userFarmingID ? "🌱 Planted" : "⚠️ Plant failed",
      });
    }

    await wait(5000); // check every 5s
  }
}

// 🚀 Start farm
async function startFarm() {
  console.log("🌾 Starting Chainers farm automation...");

  // Start dashboard
  setInterval(showDashboard, 15000);

  // Start parallel bed cycles
  for (const seedInfo of plantSeed) {
    bedCycle(seedInfo);
  }
}

startFarm().catch(err => console.error("💥 Fatal error:", err.message));






