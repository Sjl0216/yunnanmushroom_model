// 野生菌业务元数据表
// 对应模型输出的 26 个类别
export const MUSHROOM_META = {
  "0": { id: 1, name: "松茸", englishName: "matsutake", isPoisonous: 0, category: "可食用", description: "名贵食用菌，具有独特香气，被称为“菌中之王”。" },
  "1": { id: 2, name: "鸡枞", englishName: "termitomyces", isPoisonous: 0, category: "可食用", description: "四大名菌之一，肉质肥厚，味道鲜甜。" },
  "2": { id: 3, name: "干巴菌", englishName: "ganba_mushroom", isPoisonous: 0, category: "可食用", description: "云南特有野生菌，香味浓郁，嚼劲十足。" },
  "3": { id: 4, name: "白牛肝菌", englishName: "bolete_white", isPoisonous: 0, category: "可食用", description: "世界著名的美味食用菌。" },
  "4": { id: 5, name: "见手青", englishName: "bolete_bluebury", isPoisonous: 2, category: "需谨慎", description: "伤后变青，含有微量毒素，必须高温彻底烹饪方可食用。" },
  "5": { id: 6, name: "黄牛肝菌", englishName: "bolete_yellow", isPoisonous: 0, category: "可食用", description: "肉质厚实，口感滑嫩。" },
  "6": { id: 7, name: "松露", englishName: "truffle", isPoisonous: 0, category: "可食用", description: "生长于地下的名贵块菌，具有特殊的香气。" },
  "7": { id: 8, name: "青头菌", englishName: "russula_green", isPoisonous: 0, category: "可食用", description: "云南深受喜爱的食用菌，口感清脆。" },
  "8": { id: 9, name: "鸡油菌", englishName: "chanterelle", isPoisonous: 0, category: "可食用", description: "世界著名食菌，具有类似杏子的香味。" },
  "9": { id: 10, name: "竹荪", englishName: "bamboo_fungus", isPoisonous: 0, category: "可食用", description: "菌中皇后，常用于高档汤菜。" },
  "10": { id: 11, name: "羊肚菌", englishName: "morel", isPoisonous: 0, category: "可食用", description: "外形奇特，口感鲜嫩，营养价值极高。" },
  "11": { id: 12, name: "虎掌菌", englishName: "black_tiger_mushroom", isPoisonous: 0, category: "可食用", description: "肉质细嫩，香味浓郁。" },
  "12": { id: 13, name: "奶浆菌", englishName: "lactarius_milkcap", isPoisonous: 0, category: "可食用", description: "破损后流出白色浆液，味道鲜甜。" },
  "13": { id: 14, name: "铜绿菌", englishName: "lactarius_green", isPoisonous: 0, category: "可食用", description: "红汁乳菇，在云南广泛分布。" },
  "14": { id: 15, name: "谷熟菌", englishName: "cereal_mushroom", isPoisonous: 0, category: "可食用", description: "常见野生食用菌，口感扎实。" },
  "15": { id: 16, name: "马屁泡", englishName: "puffball", isPoisonous: 0, category: "可食用", description: "幼时肉质白色可食，成熟后内部变为孢子粉。" },
  "16": { id: 17, name: "珊瑚菌/刷把菌", englishName: "coral_mushroom_mix", isPoisonous: 0, category: "可食用", description: "形似珊瑚，脆嫩可口，部分品种需注意区分。" },
  
  // 有毒/剧毒
  "17": { id: 18, name: "毒蝇伞", englishName: "amanita_muscaria", isPoisonous: 1, category: "剧毒", description: "典型毒蘑菇，红伞白点，含有神经毒素。" },
  "18": { id: 19, name: "白毒伞", englishName: "amanita_exitialis", isPoisonous: 1, category: "剧毒", description: "致命鹅膏，剧毒，致死率极高！" },
  "19": { id: 20, name: "鹅膏毒伞", englishName: "amanita_phalloides", isPoisonous: 1, category: "剧毒", description: "死亡帽，含有剧毒鹅膏肽。" },
  "20": { id: 21, name: "铁锈环柄菇", englishName: "amanita_bisulcata", isPoisonous: 1, category: "剧毒", description: "含有剧毒毒素，严禁采食。" },
  "21": { id: 22, name: "催吐红菇", englishName: "russula_emetica", isPoisonous: 1, category: "有毒", description: "引起严重的胃肠炎症状，味苦辣。" },
  "22": { id: 23, name: "绿孢伞", englishName: "chlorophyllum_molybdites", isPoisonous: 1, category: "有毒", description: "常见的引起中毒的伞菌。" },
  "23": { id: 24, name: "橙黄菇", englishName: "omphalotus_olearius", isPoisonous: 1, category: "有毒", description: "含有胃肠道毒素，常与鸡油菌混淆。" },
  "24": { id: 25, name: "假羊肚菌", englishName: "gyromitra_esculenta", isPoisonous: 1, category: "剧毒", description: "含有鹿花蕈素，具有神经毒性。" },
  "25": { id: 26, name: "黄褶革菌", englishName: "entoloma_sinuatum", isPoisonous: 1, category: "剧毒", description: "致死级剧毒！" }
};
