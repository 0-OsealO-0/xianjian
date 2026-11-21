/* 先见 · 数据层 v0.2
   改这里就能换专业：COURSES 是课程与知识点，DIRECTIONS 是方向与任务链。 */

const SCHOOL = {
  school: "东南大学",
  major: "电子信息类",
  note: "本版样本：东南大学电子信息类",
};

/* ───────────── 1. 课程与知识点 ─────────────
   每个 unit 是一个可以在三态之间切换的知识点：
   "" 没碰 / "doing" 在学 / "done" 学过                       */

const COURSES = [
  {
    id: "gaoshu", name: "高等数学", when: "大一", units: [
      { id: "g-limits", name: "极限与连续" },
      { id: "g-deriv", name: "导数与微分" },
      { id: "g-integral", name: "积分" },
      { id: "g-series", name: "级数与泰勒展开" },
      { id: "g-multi", name: "多元微积分" },
    ],
  },
  {
    id: "xiandai", name: "线性代数", when: "大一", units: [
      { id: "l-det", name: "矩阵与行列式" },
      { id: "l-vector", name: "向量组与秩" },
      { id: "l-eigen", name: "特征值与二次型" },
    ],
  },
  {
    id: "clang", name: "C 语言", when: "大一", units: [
      { id: "c-flow", name: "语法、流程与函数" },
      { id: "c-pointer", name: "指针与数组" },
      { id: "c-mem", name: "动态内存与常见错误" },
      { id: "c-struct", name: "结构体、链表与文件" },
    ],
  },
  {
    id: "dawu", name: "大学物理", when: "大一下", units: [
      { id: "w-mech", name: "力学" },
      { id: "w-em", name: "电磁学" },
      { id: "w-optics", name: "光学" },
    ],
  },
  {
    id: "gailv", name: "概率论与数理统计", when: "大二", units: [
      { id: "p-rv", name: "随机变量与分布" },
      { id: "p-expect", name: "期望、方差与大数定律" },
    ],
  },
  {
    id: "fubian", name: "复变函数与积分变换", when: "大二", units: [
      { id: "f-analytic", name: "解析函数与留数" },
      { id: "f-transform", name: "傅里叶与拉普拉斯变换" },
    ],
  },
  {
    id: "dianlu", name: "电路基础", when: "大二", units: [
      { id: "e-law", name: "电路基本定律" },
      { id: "e-ac", name: "正弦稳态与相量" },
      { id: "e-transient", name: "一阶暂态" },
    ],
  },
  {
    id: "modian", name: "模拟电子技术", when: "大二", units: [
      { id: "a-diode", name: "二极管与三极管" },
      { id: "a-amp", name: "放大电路与反馈" },
    ],
  },
  {
    id: "shudian", name: "数字电子技术", when: "大二", units: [
      { id: "d-gate", name: "逻辑门与布尔代数" },
      { id: "d-seq", name: "触发器与时序逻辑" },
    ],
  },
  {
    id: "xinhao", name: "信号与系统", when: "大二", units: [
      { id: "s-conv", name: "卷积与系统响应" },
      { id: "s-fourier", name: "傅里叶分析" },
      { id: "s-laplace", name: "拉普拉斯变换" },
      { id: "s-sample", name: "采样与重建" },
    ],
  },
  {
    id: "txyl", name: "通信原理", when: "大三", units: [
      { id: "t-mod", name: "模拟与数字调制" },
      { id: "t-code", name: "信源与信道编码" },
      { id: "t-channel", name: "信道与噪声" },
    ],
  },
  {
    id: "dsp", name: "数字信号处理", when: "大三", units: [
      { id: "x-dft", name: "DFT 与 FFT" },
      { id: "x-filter", name: "数字滤波器设计" },
    ],
  },
  {
    id: "dccd", name: "电磁场与电磁波", when: "大三", units: [
      { id: "m-static", name: "静电场与稳恒磁场" },
      { id: "m-wave", name: "平面波与传输线" },
      { id: "m-line", name: "微波网络与天线" },
    ],
  },
  {
    id: "weiji", name: "微机原理与接口", when: "大三", units: [
      { id: "u-inst", name: "指令系统与寻址" },
      { id: "u-io", name: "中断与接口" },
    ],
  },
];

/* 知识点索引：id → {name, course} */
const UNITS = {};
COURSES.forEach((c) => c.units.forEach((u) => {
  UNITS[u.id] = { name: u.name, course: c.name, courseId: c.id };
}));

/* 需要补的时候，怎么补（没有写的用通用说法） */
const FIX = {
  "p-rv": {
    why: "加噪之后「这次会不会判错」是个随机事件。不先把随机变量搞明白，你画出来的曲线只能靠猜。",
    how: [
      "翻到教材里「随机变量」这一节的第一个例子，只读那一个",
      "用一句话写下：什么叫「一个随机变量的分布」",
      "做一道最简单的题：给一个均匀分布，求概率",
    ],
  },
  "g-integral": {
    why: "误码率本质是一个积分——把「落在判决边界另一侧的概率」加起来。不补这块，你只能记住结论。",
    how: ["看积分作为「面积累加」的那一节", "把 y=1 到 3 上的 1/x 面积手算一遍", "用一句话解释定积分和求和的关系"],
  },
  "g-deriv": {
    why: "做优化、做最大似然、看曲线斜率，都要导数。它出现得比你想象早。",
    how: ["看导数定义的那一节（差商的极限）", "手算 f(x)=x²+1/x 的导数", "用一句话说明导数在几何上是什么"],
  },
  "l-det": {
    why: "数据进来是一张表、一组数。怎么把它们画成图、算成特征，靠的就是矩阵。",
    how: ["看矩阵乘法那一节，手算一个 2×2 乘 2×1", "弄懂矩阵其实是一个「线性变换」", "算一个 2×2 的行列式并解释它的几何意义"],
  },
  "l-eigen": {
    why: "特征值和特征向量是信号的「方向」：数据在哪个方向上变化最大，就靠它找出来。",
    how: ["看特征值定义 Av=λv 那一节", "手算 [[2,0],[0,3]] 的特征值", "用一句话说清「特征向量为什么是不变方向」"],
  },
  "s-fourier": {
    why: "你看到的一条曲线，背后是一堆正弦叠加。不补傅里叶，很多图你只能看形状。",
    how: ["看「周期信号的频谱」那一节", "把方波的前三项谐波画出来叠加看看", "用一句话说明时域和频域在看同一件事"],
  },
  "s-sample": {
    why: "采样率决定了你能看到多快的闪烁。这一块直接决定你的实验能不能做成。",
    how: ["看采样定理那一节", "算一算 1 kHz 信号至少要多快的采样率", "用一句话解释「混叠」是什么现象"],
  },
  "d-gate": {
    why: "芯片内部就是一堆逻辑门在开关。先弄懂门，才能明白功耗和速度从哪来。",
    how: ["看真值表与逻辑门符号那一节", "写出反相器真值表并画 CMOS 结构", "用一句话说明「为什么反相器只在翻转时耗电」"],
  },
  "d-seq": {
    why: "计数器、寄存器这些「有记忆」的电路，是芯片里时序逻辑的起点。",
    how: ["看触发器（D 触发器）那一节", "用 4 个 D 触发器画出 4 位计数器", "用一句话说明「时钟为什么是关键」"],
  },
  "w-em": {
    why: "电磁波怎么反射、怎么绕射，很多实验现象只能靠这一块解释。",
    how: ["看平面电磁波那一节", "记住波长 = 光速 / 频率，并算一次 2.4 GHz", "用一句话说明金属为什么能反射电磁波"],
  },
  "w-optics": {
    why: "光也是电磁波。了解了干涉与折射，显示器、光纤里的现象才说得通。",
    how: ["看折射与全反射那一节", "算一次临界角（n=1.5 到空气）", "用一句话说明为什么光纤能把光关在里面"],
  },
  "u-inst": {
    why: "「芯片卡在搬数据」这件事，要从指令和数据在存储之间来回搬才能看懂。",
    how: ["看指令格式那一节（操作码+地址）", "写出一条最简单的「取数-相加-存回」指令序列", "用一句话说明「冯诺依曼瓶颈」"],
  },
  "m-wave": {
    why: "天线的尺寸不是随便定的，它由波长决定。这块不补，尺寸只能背。",
    how: ["看传输线那一节（驻波与反射）", "算一次 2.4 GHz 的波长与四分之一波长", "用一句话说明为什么天线尺寸接近波长的一半"],
  },
  "c-flow": {
    why: "你要跑的第一个实验大概率是写几行代码。语法这块不用精通，能跑起来就够。",
    how: ["把输入、输出、循环、判断四件事各写一个最小例子", "跑通一个「读数→算一下→打印」的小程序", "把报错信息读懂一次"],
  },
};

/* 学习任务 = 补一块地基；到哪都能生成 */
function learnTask(unitId) {
  const u = UNITS[unitId] || { name: unitId, course: "" };
  const f = FIX[unitId] || {
    why: `「${u.name}」是后面几步要用到的一块地基，现在补最省力。`,
    how: ["翻到教材对应那一节，只读这一节", "用一句话写下它解决什么问题", "找一道最基础的题做一遍"],
  };
  return {
    key: "learn:" + unitId,
    k: "learn",
    unit: unitId,
    t: `补一块地基：${u.name}`,
    min: 45,
    why: f.why,
    how: f.how,
    req: [],
    from: u.course,
  };
}

/* ───────────── 2. 六个方向 ─────────────
   steps 里的 req 是「做这件事之前最好先有的知识」。
   没学过的话，会自动插一条补地基任务在前面——这就是「被问题拖着走」。 */

const DIRECTIONS = [
  {
    id: "comm",
    name: "通信与网络",
    accent: "#1f4fd8",
    tag: "6G · 空天地一体",
    teaser: "把信息送过一条会衰减、会多径、会互相干扰的通道，还要认得出它。",
    goal: "几天之后，你手上会有一张自己画出来的误码率曲线，并且能指着它解释：为什么换一种调制方式，它就整体右移了。",
    steps: [
      {
        k: "read", t: "先看一张别人画好的图", min: 25,
        why: "不用先学任何课。这张图上只有两条曲线，你要做的只是看出它们的关系。",
        how: [
          "搜「BPSK 16QAM 误码率曲线」，随便找一张对比图",
          "横轴是信噪比，纵轴是出错概率——先确认你认得这两个轴",
          "用手机拍下这张图，或者存下来",
          "写下一句你现在看到的现象（哪怕只是「下面那条更平」）",
        ],
      },
      {
        k: "do", t: "自己把 BPSK 画一遍", min: 40,
        why: "看别人画和自己画，中间差着一整套「原来点是落在两个位置上的」的理解。",
        how: [
          "装好 Python，新建一个文件（numpy + matplotlib 就够）",
          "生成 1000 个随机的 0/1，每个映射成一个点：0→(-1)、1→(+1)",
          "把这些点画在一条数轴上，看看它们只落在两个位置",
          "进阶：给每个点加一点随机噪声，再画一次，看团块变胖",
        ],
        ask: {
          q: "你画的那条数轴上，点只落在两个地方。如果噪声大到什么程度，这两个团就会开始重叠？用你自己的话说。",
          expect: ["重叠", "噪声", "距离", "判决", "分不开", "中间"],
          gap: "p-rv",
          follow: "对，关键就是「距离」和「噪声幅度」的比值。这个比值后来有个名字，叫信噪比。",
        },
      },
      {
        k: "do", t: "给它加噪声，跑出误码率", min: 60,
        why: "这一步开始，你画的图会和课本上那张对上了。对上的一瞬间，这块知识就归你了。",
        how: [
          "对每个点加高斯噪声，噪声大小可以调",
          "判错的标准很简单：加完噪声后离哪个理想点更近，就判成谁",
          "统计一下判错的个数，除以总数，就是误码率",
          "换 5 个不同的噪声大小，各跑一次，得到 5 个点",
          "把这 5 个点连成线——这就是你自己画的误码率曲线",
        ],
        req: ["p-rv"],
        ask: {
          q: "噪声大小增加时，你算出来的误码率是怎么变的？为什么会这样变？",
          expect: ["增加", "变大", "上升", "指数", "越来越", "距离"],
          gap: "g-integral",
          follow: "对：噪声越大，点越容易越过中点。而且它不是线性变差——是指数级变差，这就是为什么那条曲线会那么陡。",
        },
      },
      {
        k: "check", t: "解释一个取舍：为什么大家不都用高阶调制", min: 35,
        why: "设备里天天在做这个取舍。你能讲清楚它，就已经比大多数同学更懂这套系统了。",
        how: [
          "同一个噪声下，把 4 个点的星座图（QPSK）和 16 个点的（16QAM）画在一起",
          "看它们的点距变小了多少",
          "写三句话：为什么点越密越容易错、为什么还要用更密的调制、什么情况下值得",
        ],
        ask: {
          q: "同样发射功率下，16QAM 为什么比 QPSK 更容易出错？既然更容易错，为什么 5G 还要用它？",
          expect: ["点距", "距离", "更密", "速率", "更快", "吞吐", "速度"],
          gap: "p-rv",
          follow: "对——点挤得更近，同样的噪声就更容易跨过边界；但它一次能带 4 个比特而不是 2 个，所以信号好的时候用它更划算。",
        },
      },
    ],
    unlock: "你能解释一句话：为什么信号好的时候要用更密的调制，信号差的时候要退回去。",
  },

  {
    id: "dsp",
    name: "信号与信息处理",
    accent: "#14735a",
    tag: "雷达 · 阵列 · 语音",
    teaser: "从被噪声淹掉的数据里，把想要的那一点结构抠出来。",
    goal: "你会用两段手机录音测出一个方向——这件事听起来像魔法，其实是两段波形差了一个时间。",
    steps: [
      {
        k: "read", t: "先弄明白「方向」是怎么被算出来的", min: 20,
        why: "先有个画面：两个麦克风听到同一句话，声音到达的时间差一点点。",
        how: [
          "搜「麦克风阵列 声源定位 原理」，看前两段解释",
          "找到一个关键事实：两个麦克风之间，声音到的时间不一样",
          "用一句话写下你的理解",
        ],
      },
      {
        k: "do", t: "用手机录两段声音，量出时间差", min: 45,
        why: "这是整个方向最原始的一步：先把数据拿到手，再谈算法。",
        how: [
          "手机开两个录音 App 同时录（或者同一个 App 分两个文件），间隔一米左右放两个位置",
          "拍一下手，或者念一句话",
          "用 Audacity 打开两条音轨，看同一个声音峰值在时间轴上错开了多少",
          "记下这个差值（毫秒）",
        ],
        ask: {
          q: "两段录音里同一个掌声错开了几毫秒？如果两个麦克风离得更远，这个差值会变大还是变小？",
          expect: ["变大", "更远", "距离", "毫秒", "时间差"],
          gap: "g-deriv",
          follow: "对，距离越远时间差越大。知道了时间差和声速，就能反推出方向——这就是定位的全部起点。",
        },
      },
      {
        k: "do", t: "写几行代码，把时间差自动算出来", min: 60,
        why: "人眼看峰值只能估个大概。让程序算，才能做得又快又准。",
        how: [
          "用 Python 读入两段音频（scipy.io.wavfile 或 soundfile）",
          "把两条波形按不同的偏移量对齐，算它们的相似程度",
          "相似程度最高的那个偏移量，就是时间差",
          "把相似程度随偏移量变化的曲线画出来，你会看到一个尖峰",
        ],
        req: ["g-integral"],
        ask: {
          q: "你画出来的那条曲线为什么会出现一个明显的峰？峰的位置代表什么？",
          expect: ["对齐", "相似", "最大", "时间差", "偏移"],
          gap: "g-integral",
          follow: "对：当两条波形对齐时，逐点相乘再求和会最大——这个运算就是「相关」，本质是个积分。",
        },
      },
      {
        k: "check", t: "把时间差换算成角度", min: 30,
        why: "到这一步，你已经有能力说出「声音从左边 30 度来」这种话了。",
        how: [
          "查一下声速（约 343 m/s），以及你两个录音位置的距离",
          "用「时间差 × 声速 = 路程差」算出角度",
          "写下完整的推算过程，标出你用的假设",
        ],
        req: ["g-deriv"],
        ask: {
          q: "你的估算里最不可靠的假设是哪一个？如果那个假设不成立，结果会偏多少？",
          expect: ["假设", "声速", "距离", "误差", "不准", "偏"],
          gap: "l-eigen",
          follow: "很好——能说出自己方法的薄弱处，比算对一个数更有价值。下一步（用多个麦克风）就是为了对付这个弱点。",
        },
      },
    ],
    unlock: "你能用两段录音讲清楚「方向是怎么被算出来的」。",
  },

  {
    id: "ic",
    name: "微电子与集成电路",
    accent: "#7a3ea8",
    tag: "CMOS · 存算一体 · RISC-V",
    teaser: "在几十亿个晶体管里，用纳米的尺度换性能、功耗和成本。",
    goal: "你会亲手算清一块芯片里最基础的一笔账：一次翻转要花多少能量。",
    steps: [
      {
        k: "read", t: "先看懂「芯片卡在搬数据」这句话", min: 20,
        why: "现在最热的方向之一，起因只是一个很朴素的观察：算得比搬得快。",
        how: [
          "搜「冯诺依曼瓶颈 存算一体」，看两段解释",
          "找到一句话：算力和存储之间的搬运，成了瓶颈",
          "用一句话写下：为什么「把计算搬到数据旁边」能省事",
        ],
      },
      {
        k: "do", t: "算一次反相器的账", min: 40,
        why: "所有功耗讨论，最后都落在这一个最小的电路上。",
        how: [
          "查 CMOS 反相器的结构（一个 PMOS 一个 NMOS）",
          "写出它的真值表：输入 0 时输出什么，输入 1 时呢",
          "查到公式：动态功耗 ≈ α·C·V²·f，把每个量的含义写清楚",
          "用一个具体数字算一遍（比如 C=1pF、V=1V、f=1GHz）",
        ],
        req: ["d-gate"],
        ask: {
          q: "为什么反相器在「保持 0」或「保持 1」的时候几乎不耗电，只有在翻转时才耗？",
          expect: ["翻转", "充电", "放电", "电容", "开关", "短路"],
          gap: "d-gate",
          follow: "对：耗电来自给电容充放电，而充放电只发生在电平切换的那一瞬间。所以降压、降频、少翻转，都是省电的路子。",
        },
      },
      {
        k: "do", t: "用 4 个触发器搭一个计数器", min: 60,
        why: "这是芯片里第一个「有记忆」的电路。搭过一次，时序逻辑就不再抽象。",
        how: [
          "装上 Logisim（免费，双击就能跑）",
          "放 4 个 D 触发器，把输出接到下一个的时钟或数据端",
          "加一个时钟，让它每来一个脉冲就加一",
          "看它从 0000 数到 1111 再回到 0000",
        ],
        req: ["d-seq"],
        ask: {
          q: "你的计数器为什么在 1111 之后回到 0000，而不是继续往上数？是谁决定了它「数到几」？",
          expect: ["溢出", "进位", "位宽", "4 位", "清零", "回绕"],
          gap: "d-seq",
          follow: "对，是位宽决定的：4 位只能表示 16 个数，第 17 个就溢出了。真实芯片里「数到几」是被设计好的。",
        },
      },
      {
        k: "check", t: "回答一个真问题：为什么要把计算搬进存储", min: 30,
        why: "这是现在产业界砸钱最多的方向，你能讲清楚它，面试时是加分项。",
        how: [
          "把「搬一次数据的代价」和「算一次的代价」做个粗略对比（查两个量级即可）",
          "写下：存算一体省掉的是哪一段",
          "写下：它带来的新问题是什么（精度？工艺？）",
        ],
        ask: {
          q: "存算一体省掉的是「搬运」，那它有没有引入新的代价？说一个你想到的。",
          expect: ["精度", "工艺", "良率", "温度", "设计", "难"],
          gap: "u-inst",
          follow: "对，代价通常落在精度、工艺复杂度和设计难度上。所有「省掉一段」的方案，都要回答「代价转移到哪了」。",
        },
      },
    ],
    unlock: "你能算清一块芯片里最基础的一笔功耗账，并说清存算一体在换什么。",
  },

  {
    id: "em",
    name: "电磁场与微波",
    accent: "#b4530a",
    tag: "天线 · 超表面 · 毫米波",
    teaser: "让波在金属和介质之间按设计的方式走，收得住也发得出去。",
    goal: "你会用一把尺子和一个水盆，亲手验证波长与反射这两件最基础的事。",
    steps: [
      {
        k: "read", t: "先看懂「天线为什么长这样」", min: 20,
        why: "天线不是随便一根金属。它的尺寸被一个数锁死了。",
        how: [
          "搜「半波偶极子天线 长度 波长」，看一张示意图",
          "找到关键关系：天线长度大约是波长的一半",
          "用一句话写下你的疑问（比如「为什么是一半」）",
        ],
      },
      {
        k: "do", t: "用尺子量出 2.4 GHz 的波长", min: 30,
        why: "把一个抽象的数变成你手里能量出来的长度，物理就不再是公式。",
        how: [
          "查 2.4 GHz 的频率，用波长 = 光速 / 频率算一次（答案约 12.5 cm）",
          "拿尺子在手边比出 12.5 cm，感受一下它有多长",
          "再算四分之一波长（约 3.1 cm），这差不多就是很多小天线金属段的长度",
        ],
        ask: {
          q: "为什么 WiFi 天线可以塞进手机里，而有些基站天线却有一人多高？用波长解释。",
          expect: ["波长", "频率", "低频", "高频", "尺寸", "成正比"],
          gap: "m-wave",
          follow: "对：天线尺寸跟着波长走。频率越高波长越短，天线就能做小——这也是毫米波被看好的原因之一。",
        },
      },
      {
        k: "do", t: "做一个反射实验", min: 45,
        why: "金属会反射电磁波，这件事你亲手看见一次就再也不会忘。",
        how: [
          "准备一盆水、一块金属板（或铝箔）",
          "水面当反射面，用手机手电筒斜着照过去，观察反射方向",
          "把金属板斜放进水里，看反射光斑怎么移动",
          "记录：入射角变大时，反射角怎么变",
        ],
        req: ["w-em"],
        ask: {
          q: "入射角变大时，反射角怎么变？这个规律叫「反射定律」，你觉得它和电磁波的哪个性质有关？",
          expect: ["相等", "一样", "反射角", "入射角", "对称"],
          gap: "w-em",
          follow: "对，反射角等于入射角——这条规律对光和电磁波是同一套。它来自边界条件：电场在界面两侧要连续。",
        },
      },
      {
        k: "check", t: "想一个真问题：为什么毫米波容易被挡住", min: 30,
        why: "5G 毫米波覆盖差是出了名的。你能不能自己推出原因，是个分水岭。",
        how: [
          "对比 2.4 GHz 和 28 GHz 的波长",
          "想一想波长和「绕过障碍物」的关系",
          "写下三句话的解释，并给出一个工程上的应对办法",
        ],
        req: ["w-em"],
        ask: {
          q: "为什么 28 GHz 的信号绕不过一堵墙，而 2.4 GHz 能勉强穿过去？给出一个工程上的应对办法。",
          expect: ["波长", "绕射", "穿透", "衰减", "中继", "基站", "密集"],
          gap: "m-wave",
          follow: "对，波长越短越不绕射、穿透损耗越大；工程上的对策就是密集布站 + 中继。所有「天生不足」的技术，最后都靠工程补救。",
        },
      },
    ],
    unlock: "你能用波长解释天线尺寸和穿透能力，并亲手验证过反射定律。",
  },

  {
    id: "opto",
    name: "光电与显示",
    accent: "#c2265c",
    tag: "硅光 · Micro-LED · 激光雷达",
    teaser: "用光子替代电子做传输、感知与显示，速度更快，功耗更低。",
    goal: "你会用手机慢动作拍下 LED 的闪烁，亲眼看到「光在带信息」。",
    steps: [
      {
        k: "read", t: "先弄明白「灯怎么携带信息」", min: 18,
        why: "可见光通信听起来很科幻，原理只有一句话。",
        how: [
          "搜「可见光通信 LiFi 原理」，看开头两段",
          "找到关键：灯亮灭得非常快，快到你眼睛看不出来",
          "用一句话写下：快慢和信息量是什么关系",
        ],
      },
      {
        k: "do", t: "用手机慢动作拍下 LED 的闪烁", min: 30,
        why: "这件事你今晚就能做，而且亲眼看见之后的冲击比看十页书都强。",
        how: [
          "打开手机相机的慢动作模式（120fps 或 240fps）",
          "对着一个 LED 灯（灯带最好），录几秒",
          "回放，观察画面里的灯有没有明暗条纹或闪烁",
          "换一个灯泡再试一次，对比差别",
        ],
        ask: {
          q: "你在慢动作里看到闪烁了吗？如果没有，说明什么？如果有，条纹的疏密说明了什么？",
          expect: ["看不到", "没有", "频率", "太快", "采样", "条纹"],
          gap: "s-sample",
          follow: "对：看不到说明它闪得比相机采样快——这就是「采样跟不上」；看得到条纹，说明灯是以某个固定频率在闪。",
        },
      },
      {
        k: "do", t: "算一次「相机能不能跟上」", min: 45,
        why: "这一步把「看不见」变成一道能算的题。",
        how: [
          "查你的手机慢动作是多少 fps（120 或 240）",
          "算它的采样间隔（1/fps）",
          "假设 LED 以 1 kHz 在闪，问：相机会不会看到条纹？",
          "把答案写成一句话：要看到闪烁，采样率至少要多少",
        ],
        req: ["s-sample"],
        ask: {
          q: "要让相机拍到 1 kHz 的闪烁，采样率至少要多少？为什么是这个数？",
          expect: ["2000", "两倍", "2 倍", "两倍以上", "奈奎斯特", "采样定理"],
          gap: "s-sample",
          follow: "对，至少 2000 fps——这就是采样定理：采样率要高于信号频率的两倍，否则会「混叠」，看到的是假的慢动作。",
        },
      },
      {
        k: "check", t: "回答一个产业问题：为什么硅做不了激光器", min: 30,
        why: "这是硅光领域最著名的一道坎，理解了它，你就理解了整个硅光产业在忙什么。",
        how: [
          "搜「硅 间接带隙 不能发光 原因」，看一段解释",
          "找到关键词：间接带隙、发光效率低",
          "写下：为什么「能发光」和「发光效率高」是两件事",
          "再说一个产业上绕过去的办法（外延生长、键合）",
        ],
        req: ["w-optics"],
        ask: {
          q: "硅能导电也能导光，为什么偏偏不能高效地「发光」？产业上怎么绕过这个限制？",
          expect: ["间接带隙", "带隙", "复合", "效率", "键合", "外延", "III-V"],
          gap: "w-optics",
          follow: "对：硅是间接带隙，电子和空穴复合时动量对不上，能量多半变成热而不是光；产业上的办法是把 III-V 材料贴上去（键合/外延）。",
        },
      },
    ],
    unlock: "你能解释采样与闪烁的关系，并说清硅光最著名的那道坎。",
  },

  {
    id: "ai4ee",
    name: "智能信息处理",
    accent: "#0f6d8c",
    tag: "端侧推理 · AI for Comm",
    teaser: "把统计学习塞进信号链，在仿真与实测的缝隙里做工程。",
    goal: "你会亲手训练一个小模型，让它分辨两种调制方式——并且知道它为什么可能靠不住。",
    steps: [
      {
        k: "read", t: "先看一个「不懂协议也能认信号」的例子", min: 20,
        why: "自动调制识别是这个方向最直观的入口，一张图就能说明白。",
        how: [
          "搜「自动调制识别 星座图 深度学习」，看一张示意图",
          "找到关键：不同的调制方式，星座图形状不一样",
          "用一句话写下：为什么「看图」就能分类",
        ],
      },
      {
        k: "do", t: "用几行代码画出 IQ 星座图", min: 45,
        why: "把信号变成一张图，是这一整条路子上的第一个动作。",
        how: [
          "用 numpy 生成两串随机符号，分别按 BPSK（两个点）和 QPSK（四个点）映射",
          "每个点加一点噪声",
          "把这两组点画在同一张图上（横轴 I、纵轴 Q）",
          "观察两组点的分布差别",
        ],
        req: ["c-flow"],
        ask: {
          q: "BPSK 和 QPSK 的星座图，你一眼看出的差别是什么？如果噪声再大一点，这个差别还看得出来吗？",
          expect: ["两个点", "四个点", "簇", "团", "重叠", "模糊"],
          gap: "l-det",
          follow: "对，一个是 2 个团、一个是 4 个团。噪声一大，团就糊在一起——所以「能不能分」是信噪比决定的，不是算法决定的。",
        },
      },
      {
        k: "do", t: "训练一个小模型，让它分辨这两种信号", min: 70,
        why: "这是你第一次把「学习」用在信号上，也是这个方向的敲门砖。",
        how: [
          "准备一批数据：各 500 个样本，每样本是一小段 IQ 序列",
          "用 scikit-learn 的 SVM 或一个两层小网络训练（别上大模型，没必要）",
          "留 20% 做测试，看准确率能到多少",
          "把混淆矩阵打印出来",
        ],
        req: ["l-det"],
        ask: {
          q: "你的模型在测试集上准确率是多少？如果把噪声调大再测一次，掉得多不多？",
          expect: ["准确率", "掉", "下降", "噪声", "百分之", "%"],
          gap: "l-det",
          follow: "对。模型的表现跟着信噪比走，这说明它学到的是「分布的形状」，不是「协议的规定」——这正是这个方向有意思的地方。",
        },
      },
      {
        k: "check", t: "想清楚一件事：模型凭什么信得过", min: 35,
        why: "在工程里，一个说不清为什么有效的模型，是不敢用的。",
        how: [
          "想一想：你的训练数据是仿真生成的，真实信号会有哪些不同",
          "列出 3 个仿真里没有、真实里一定有的东西",
          "写下：如果真实数据进来，你的模型最可能在哪失效",
        ],
        req: ["p-rv"],
        ask: {
          q: "仿真数据和真实信号之间，最大的差别是什么？这个差别会让你的模型怎么失效？",
          expect: ["噪声", "信道", "相位", "频偏", "仿真", "真实", "分布"],
          gap: "p-rv",
          follow: "对：真实信号有多径、频偏、相位漂移，仿真里往往没有。模型学到的是仿真的分布，换到真实数据上就掉——这叫域偏移。",
        },
      },
    ],
    unlock: "你能训练一个信号分类模型，并且说清它凭什么可能靠不住。",
  },
];

/* 建成索引 */
const DIR_BY_ID = {};
DIRECTIONS.forEach((d) => { DIR_BY_ID[d.id] = d; });

/* 矩阵彩蛋：留在「看见地图」页，回答「矩阵到底用来干什么」 */
const MATRIX_HOOKS = [
  {
    id: "ofdm",
    head: "矩阵 · OFDM",
    body: "一个 OFDM 符号就是一次矩阵乘法：X = Wx，W 是 DFT 矩阵。FFT 只是不显式把它乘出来而已。",
    shows: "你学的「矩阵乘法」，在通信里是一次调制。",
  },
  {
    id: "mimo",
    head: "矩阵 · MIMO",
    body: "接收信号 y = Hx + n。把 H 做奇异值分解 H = UΣVᴴ，Σ 的对角元就是每条并行子信道的增益，秩小就是你天线条数再多也开不出并行车道。",
    shows: "你学的「特征值/奇异值」，决定了一个系统能跑多快。",
  },
  {
    id: "conv",
    head: "矩阵 · 卷积",
    body: "卷积就是乘一个稀疏的 Toeplitz 矩阵。所以 im2col + GEMM 能把卷积变成通用矩阵乘法，GPU 才跑得快。",
    shows: "你学的「线性变换」，解释了为什么要那样做工程优化。",
  },
];

/* ───────────── 3. 判读 ─────────────
   规则引擎：命中关键词越多，说明答到了点上。
   接模型之后可以换成模型判读（设置里填接口即可）。 */

function judge(ask, answer) {
  const text = (answer || "").trim();
  if (text.length < 4) return { level: "empty", hits: [], miss: ask.expect };
  const hits = ask.expect.filter((k) => text.indexOf(k) >= 0);
  const score = hits.length / ask.expect.length;
  const level = score >= 0.34 ? "good" : score > 0 ? "mid" : "low";
  return { level, hits, miss: ask.expect.filter((k) => hits.indexOf(k) < 0) };
}

/* ───────── 去哪学：搜索深链 + 官方文档 ─────────
   不硬编码具体视频（链接会失效、也可能挂羊头卖狗肉），只给"去哪搜、用什么词搜"，
   并把排序偏到「最多播放」，让平台自己把质量高的排上来。 */
const RES_SITES = {
  bili: "https://search.bilibili.com/all?keyword=",
  biliOrder: "&order=click",                    // 按播放量排，先看公认的
  mooc: "https://www.icourse163.org/search.htm?search=",
  gh: "https://github.com/search?q=",
  ghType: "&type=repositories",
};

/* 每个知识点：搜什么词、读哪份官方文档、GitHub 上找什么 */
const SRC = {
  "c-flow":      { kw: "C 语言 入门 教程 完整", doc: { name: "cppreference（C）", url: "https://zh.cppreference.com/w/c" } },
  "c-pointer":   { kw: "C 语言 指针 详解 图解", doc: { name: "cppreference 指针", url: "https://zh.cppreference.com/w/c/language/pointer" }, repo: "c pointer examples" },
  "c-mem":       { kw: "C 语言 动态内存 malloc free 通俗", repo: "c memory allocator example" },
  "c-struct":    { kw: "C 语言 链表 手写 完整代码", repo: "linked list in c" },
  "cpp-oop":     { kw: "C++ 类与对象 零基础", doc: { name: "cppreference（C++）", url: "https://zh.cppreference.com/w/cpp" } },
  "cpp-stl":     { kw: "C++ STL vector map 用法", doc: { name: "cppreference 容器", url: "https://zh.cppreference.com/w/cpp/container" }, repo: "cpp stl examples" },
  "cpp-mem":     { kw: "C++ 智能指针 RAII 讲清楚", doc: { name: "cppreference RAII", url: "https://zh.cppreference.com/w/cpp/language/raii" } },
  "cpp-build":   { kw: "CMake 入门 一个例子", doc: { name: "CMake 官方教程", url: "https://cmake.org/cmake/help/latest/guide/tutorial/index.html" }, repo: "cmake minimal example" },
  "py-base":     { kw: "Python 零基础 入门", doc: { name: "Python 官方教程（中文）", url: "https://docs.python.org/zh-cn/3/tutorial/" } },
  "py-numpy":    { kw: "NumPy 入门 数组 广播", doc: { name: "NumPy 快速入门", url: "https://numpy.org/doc/stable/user/quickstart.html" }, repo: "numpy tutorial notebooks" },
  "py-data":     { kw: "Python 读写文件 csv", doc: { name: "Python 文件读写", url: "https://docs.python.org/zh-cn/3/tutorial/inputoutput.html#reading-and-writing-files" } },
  "py-pandas":   { kw: "pandas 10 分钟 入门", doc: { name: "pandas 10 minutes", url: "https://pandas.pydata.org/docs/user_guide/10min.html" }, repo: "pandas tutorial notebook" },
  "py-ml":       { kw: "sklearn 逻辑回归 入门 例子", doc: { name: "scikit-learn 入门", url: "https://scikit-learn.org/stable/getting_started.html" }, repo: "sklearn examples" },
  "mt-matrix":   { kw: "MATLAB 矩阵 入门", doc: { name: "MATLAB 快速入门", url: "https://ww2.mathworks.cn/help/matlab/getting-started-with-matlab.html" } },
  "mt-sim":      { kw: "MATLAB 信号 卷积 仿真", doc: { name: "MATLAB 信号处理入门", url: "https://ww2.mathworks.cn/help/signal/getting-started-with-signal-processing-toolbox.html" } },
  "mt-design":   { kw: "MATLAB designfilt 滤波器设计", doc: { name: "designfilt 文档", url: "https://ww2.mathworks.cn/help/signal/ref/designfilt.html" } },
  "jv-oop":      { kw: "Java 面向对象 零基础", doc: { name: "dev.java 官方教程", url: "https://dev.java/learn/" } },
  "jv-coll":     { kw: "Java 集合 HashMap 泛型", doc: { name: "Java 集合框架", url: "https://dev.java/learn/collections-framework/" } },
  "jv-thread":   { kw: "Java 多线程 通俗 讲清楚", doc: { name: "Java 并发基础", url: "https://dev.java/learn/concurrency/" }, repo: "java concurrency examples" },
  "jv-build":    { kw: "Maven JUnit 入门 一个例子", doc: { name: "Maven 5 分钟", url: "https://maven.apache.org/guides/getting-started/maven-in-five-minutes.html" } },
  "g-limits":    { kw: "3Blue1Brown 微积分 本质", repo: "calculus notes" },
  "g-deriv":     { kw: "导数 直觉 3Blue1Brown", repo: "gradient descent from scratch" },
  "l-vector":    { kw: "线性代数的本质 3Blue1Brown", repo: "linear algebra notes" },
  "l-det":       { kw: "行列式 几何意义 讲清楚", doc: { name: "3Blue1Brown 线性代数", url: "https://www.3blue1brown.com/topics/linear-algebra" }, repo: "linear algebra notes" },
  "l-eigen":     { kw: "特征值 特征向量 直观", repo: "eigenvalue intuition" },
  "p-dist":      { kw: "常见分布 正态 泊松 通俗", doc: { name: "可汗学院 统计", url: "https://zh.khanacademy.org/math/statistics-probability" } },
  "p-rv":        { kw: "概率论 随机变量 零基础", doc: { name: "可汗学院 概率", url: "https://zh.khanacademy.org/math/statistics-probability" } },
  "s-conv":      { kw: "信号与系统 卷积 直观", },
  "s-laplace":   { kw: "拉普拉斯变换 直观 为什么", },
  "t-mod":       { kw: "通信原理 调制 BPSK QAM", repo: "bpsk qpsk simulation python" },
  "t-code":      { kw: "信道编码 汉明码 通俗", },
  "x-dft":       { kw: "FFT 可视化 讲清楚", repo: "fft visualization" },
  "net-tcp":     { kw: "TCP 三次握手 四次挥手 通俗", doc: { name: "MDN HTTP 概述", url: "https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Overview" } },
  "net-http":    { kw: "HTTP 一次请求 发生了什么", doc: { name: "MDN HTTP", url: "https://developer.mozilla.org/zh-CN/docs/Web/HTTP" } },
  "ds-list":     { kw: "数据结构 链表 讲解", repo: "data structures in c" },
  "ds-tree":     { kw: "二叉树 遍历 动画", repo: "binary tree example" },
  "ds-sort":     { kw: "排序算法 动画 对比", repo: "sorting algorithms visualizer" },
  "co-bin":      { kw: "补码 为什么 通俗", },
  "co-cpu":      { kw: "CPU 一条指令 怎么执行", },
  "os-proc":     { kw: "进程 线程 区别 通俗", },
  "os-mem":      { kw: "虚拟内存 分页 讲清楚", },
  "dm-logic":    { kw: "命题逻辑 真值表 入门", },
  "dm-graph":    { kw: "图论 入门 BFS DFS", repo: "graph algorithms" },
  "e-law":       { kw: "基尔霍夫定律 节点 回路 入门" },
  "e-transient": { kw: "一阶电路 三要素法 讲清楚" },
  "a-diode":     { kw: "二极管 伏安特性 入门" },
  "a-amp":       { kw: "运算放大器 虚短 虚断" },
  "m-static":    { kw: "静电场 高斯定理 入门" },
  "u-io":        { kw: "单片机 IO 口 上拉电阻 为什么" },
};


/* 步骤级搜索词（比把任务标题直接丢给搜索框准得多） */
const STEP_SRC = {
  "comm:0": "BPSK QPSK 星座图 原理 讲解",
  "comm:1": "BPSK 调制 Python 仿真 画图",
  "comm:2": "误码率 BER 曲线 AWGN 仿真",
  "comm:3": "为什么不用高阶调制 16QAM 取舍",
  "sys:0": "从输入网址到页面显示 全过程",
  "sys:1": "Chrome F12 Network 面板 怎么看",
  "sys:2": "延迟 带宽 区别 为什么加带宽没用",
  "sys:3": "traceroute 每一跳 延迟 含义",
  "ml:0": "softmax 回归 手写数字 原理",
  "ml:1": "MNIST 混淆矩阵 代码",
  "ml:2": "过拟合 欠拟合 怎么判断",
  "ml:3": "梯度下降 手写 numpy 学习率",
  "gfx:0": "图像 是 函数 像素 灰度",
  "gfx:1": "canvas 贝塞尔曲线 教程",
  "gfx:2": "帧率 60 30 为什么感觉卡",
  "gfx:3": "采样 抗锯齿 锯齿 原理",
  "med:0": "医生 读 CT 流程 影像科",
  "fin:0": "风控 模型 误伤 好人 代价",
  "edu:0": "AI 家教 为什么 学生 依赖",
  "mfg:0": "工业 视觉 质检 漏检 代价",
};

function resFor(t) {
  const unit = t.unit || null;
  const s = (unit && SRC[unit]) || {};
  let stepKw = null;
  if (!unit && t.key && t.key.indexOf("step:") === 0) {
    const parts = t.key.split(":");
    stepKw = STEP_SRC[parts[1] + ":" + parts[2]] || null;
  }
  const kw = s.kw || stepKw || (unit
    ? (UNITS[unit] ? UNITS[unit].name : t.t)
    : t.t.replace(/^补一块地基：/, "")
        .replace(/^(先|自己|动手|再|把|用|跑一次|跑|手写|解释一个|解释|写一个|找一段|画一个)[\s]*/, "")
        .replace(/[，,：:（(].*$/, "").slice(0, 26));
  return {
    kw,
    doc: s.doc || null,
    repo: s.repo || null,
    bili: RES_SITES.bili + encodeURIComponent(kw) + RES_SITES.biliOrder,
    mooc: RES_SITES.mooc + encodeURIComponent(kw),
    gh: s.repo ? RES_SITES.gh + encodeURIComponent(s.repo) + RES_SITES.ghType : null,
  };
}

/* ───────── 人工策展的课程白名单（B 站搬运/公开课） ─────────
   每条都写清：谁讲的、看它解决什么、以及「别一集不落」的用法。
   url 是点击直达；没有可靠直达的用精准搜索（kind:"search"）。 */
const COURSES_DB = [
  { id: "la-3b1b", title: "线性代数的本质（3Blue1Brown 中文配音合集）", by: "3Blue1Brown · 搬运",
    url: "https://www.bilibili.com/video/av44855426", kind: "video",
    note: "先看它建立「矩阵是变换」的直觉，再回去做题；一集十几分钟，别连刷。", units: ["l-vector", "l-det", "l-eigen"] },
  { id: "la-mit", title: "MIT 18.06 线性代数（Gilbert Strang，中英字幕）", by: "MIT OCW · 搬运",
    url: "https://www.bilibili.com/video/av15463995", kind: "video",
    note: "讲得慢但透，适合卡在「为什么」的时候看一讲；不用从头刷完。", units: ["l-vector", "l-det", "l-eigen"] },
  { id: "calc-3b1b", title: "微积分的本质（3Blue1Brown 系列合集）", by: "3Blue1Brown · 搬运",
    url: "https://www.bilibili.com/video/av24325548", kind: "video",
    note: "导数、积分、级数各一集；看完立刻回去画一张图，别只看。", units: ["g-limits", "g-deriv", "g-integral", "g-series"] },
  { id: "prob-song", title: "《概率论与数理统计》教学视频（宋浩）", by: "宋浩",
    url: "https://www.bilibili.com/video/av36206436", kind: "video",
    note: "国内最稳的概率课，跟着章节跳着看；只补你现在这一步用得到的那一节。", units: ["p-rv", "p-dist", "p-expect"] },
  { id: "c-wengkai", title: "浙江大学 翁恺 C 语言程序设计", by: "翁恺 · 浙大",
    url: "https://www.bilibili.com/video/av768150164", kind: "video",
    note: "C 的入门首选，讲指针那几讲一定要看；配着写代码，不要只看。", units: ["c-flow", "c-pointer", "c-mem", "c-struct"] },
  { id: "py-bit", title: "北京理工大学 Python 语言程序设计（嵩天）", by: "嵩天 · 北理工",
    url: "https://www.bilibili.com/video/av850999395", kind: "video",
    note: "语法部分看得快一点，把时间留给动手；NumPy 那部分可以跳着看。", units: ["py-base", "py-numpy", "py-data"] },
  { id: "cpp-search", title: "C++ 类与对象 / STL（搜一门系统课）", by: "B 站",
    url: "https://search.bilibili.com/all?keyword=C%2B%2B%20%E9%9B%B6%E5%9F%BA%E7%A1%80%20%E5%AE%8C%E6%95%B4%20%E8%AF%BE%E7%A8%8B&order=click", kind: "search",
    note: "C++ 的课质量差异很大，先按播放量看前三个的前 10 分钟，再决定跟哪个。", units: ["cpp-oop", "cpp-stl", "cpp-mem"] },
  { id: "java-search", title: "Java 面向对象 / 集合 / 并发（搜系统课）", by: "B 站",
    url: "https://search.bilibili.com/all?keyword=Java%20%E5%85%A5%E9%97%A8%20%E5%AE%8C%E6%95%B4%20%E8%AF%BE%E7%A8%8B&order=click", kind: "search",
    note: "Java 的课普遍很长，只看你这一步要用的那几集。", units: ["jv-oop", "jv-coll", "jv-thread", "jv-build"] },
  { id: "matlab-kuo", title: "MATLAB 教程（台大 郭彦甫，14 课）", by: "郭彦甫 · 台大",
    url: "https://www.bilibili.com/video/av68228488", kind: "video",
    note: "中文里最好的 MATLAB 入门；画图和矩阵那两课先看。", units: ["mt-matrix", "mt-sim", "mt-design"] },
  { id: "ds-wangdao", title: "王道 数据结构", by: "王道论坛",
    url: "https://www.bilibili.com/video/av92191094", kind: "video",
    note: "应试向但讲得清楚；链表、树、排序各看一节就够用。", units: ["ds-list", "ds-tree", "ds-sort"] },
  { id: "co-csapp", title: "CMU 15-213 深入理解计算机系统（CSAPP）", by: "CMU · 搬运",
    url: "https://www.bilibili.com/video/av31289365", kind: "video",
    note: "难课。只在你被「一个 int 到底怎么存的」卡住时，看对应的那一讲。", units: ["co-bin", "co-cpu", "co-mem"] },
  { id: "os-hit", title: "哈工大 操作系统（李治军，全 32 讲）", by: "李治军 · 哈工大",
    url: "https://www.bilibili.com/video/av768653979", kind: "video",
    note: "进程、内存那几讲是精华；配合他的实验课看更好。", units: ["os-proc", "os-mem"] },
  { id: "net-ustc", title: "中科大《计算机网络：自顶向下方法》（郑烇、杨坚）", by: "郑烇 · 中科大",
    url: "https://www.bilibili.com/video/av416090103", kind: "video",
    note: "先把「分层」和「TCP」两讲看完，剩下按需。", units: ["net-tcp", "net-http"] },
  { id: "sig-zheng", title: "郑君里《信号与系统》", by: "郑君里 · 教材配套",
    url: "https://www.bilibili.com/video/av1206065115", kind: "video",
    note: "卷积、拉普拉斯那两章必看；看到公式就停，回去用代码画一遍。", units: ["s-conv", "s-laplace", "x-dft", "x-filter"] },
  { id: "comm-zhang", title: "通信原理（张锦皓，共 69 讲）", by: "张锦皓",
    url: "https://www.bilibili.com/video/av897027488", kind: "video",
    note: "讲调制那几讲配合你画的星座图看，别从头刷。", units: ["t-mod", "t-code", "t-channel"] },
  { id: "ana-hua", title: "清华大学 模拟电子技术基础（华成英，全 189 讲）", by: "华成英 · 清华",
    url: "https://www.bilibili.com/video/av23080095", kind: "video",
    note: "权威但很长；只挑你这一步对应的那一节（二极管/运放）。", units: ["a-diode", "a-amp"] },
  { id: "ml-hungyi", title: "李宏毅 机器学习（国语授权版）", by: "李宏毅 · 台大",
    url: "https://www.bilibili.com/video/av335108646", kind: "video",
    note: "讲得最像人话的 ML 课；先看「什么是机器学习」和「过拟合」两讲。", units: ["l-det", "p-rv", "p-dist"] },
];

function coursesFor(unitId) {
  return COURSES_DB.filter((c) => (c.units || []).indexOf(unitId) >= 0).slice(0, 2);
}
