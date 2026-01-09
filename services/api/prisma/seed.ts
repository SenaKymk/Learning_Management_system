import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const firstNames = [
  "Ahmet",
  "Mehmet",
  "Ayse",
  "Fatma",
  "Emre",
  "Elif",
  "Kerem",
  "Zeynep",
  "Mert",
  "Seda",
  "Burak",
  "Ceren"
];

const lastNames = [
  "Yilmaz",
  "Kaya",
  "Demir",
  "Sahin",
  "Celik",
  "Yildiz",
  "Aydin",
  "Arslan",
  "Gunes",
  "Koc",
  "Ozdemir",
  "Polat"
];

function pickRandom(list: string[]) {
  return list[Math.floor(Math.random() * list.length)];
}

function nextStudentNumber(existing: Set<string>, start: number) {
  let current = start;
  while (existing.has(String(current))) {
    current += 1;
  }
  existing.add(String(current));
  return String(current);
}

async function main() {
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      role: true,
      firstName: true,
      lastName: true,
      studentNumber: true
    }
  });

  const usedNumbers = new Set<string>();
  for (const user of allUsers) {
    if (user.studentNumber) {
      usedNumbers.add(user.studentNumber);
    }
  }

  let nextNumber = 2024001;

  for (const user of allUsers) {
    const updates: { firstName?: string; lastName?: string; studentNumber?: string | null } = {};

    if (!user.firstName) {
      updates.firstName = pickRandom(firstNames);
    }
    if (!user.lastName) {
      updates.lastName = pickRandom(lastNames);
    }

    if (user.role === "STUDENT") {
      if (!user.studentNumber) {
        updates.studentNumber = nextStudentNumber(usedNumbers, nextNumber);
        nextNumber = Number(updates.studentNumber) + 1;
      }
    } else {
      if (user.studentNumber) {
        updates.studentNumber = null;
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: updates
      });
    }
  }

  const firstCourse = await prisma.course.findFirst({
    select: { id: true }
  });

  if (!firstCourse) {
    return;
  }

  const questions = [
    {
      text: "In RAG systems, what is the main advantage of Cross-Encoder models over Bi-Encoder models in the reranking stage?",
      options: [
        "They use less memory.",
        "They jointly process the query and document with full self-attention, enabling more precise semantic scoring, but at higher computational cost.",
        "They are faster.",
        "They do not require a vector database."
      ],
      answer: 1
    },
    {
      text: "Which method is recommended to solve Temporal Coupling issues between microservices?",
      options: [
        "Asynchronous messaging and Domain Events.",
        "Synchronous HTTP calls.",
        "RPC.",
        "Shared database."
      ],
      answer: 0
    },
    {
      text: "What is the main trade-off of using Cross-Encoder based rerankers in RAG architectures?",
      options: [
        "No vector database is needed.",
        "Bi-Encoder always performs better.",
        "Higher accuracy due to joint processing, but much higher computational cost.",
        "Faster but less accurate."
      ],
      answer: 2
    },
    {
      text: "Why does Small-to-Big (Parent Document) retrieval use small chunks for indexing but larger parent documents for generation?",
      options: [
        "Small chunks are slower to process.",
        "Large embeddings are too expensive.",
        "To save vector database space.",
        "Small chunks improve retrieval precision, but generation requires broader context."
      ],
      answer: 3
    },
    {
      text: "What is the purpose of the Kernel Trick in Support Vector Machines?",
      options: [
        "Filling missing data.",
        "Mapping data to a higher-dimensional space to make it linearly separable.",
        "Reducing dataset size.",
        "Automating hyperparameter tuning."
      ],
      answer: 1
    },
    {
      text: "What distinguishes Stacking from Bagging methods?",
      options: [
        "Uses voting.",
        "Trains a meta-learner on base model predictions.",
        "Uses only identical models.",
        "Is faster."
      ],
      answer: 1
    }
  ];

  const existing = await prisma.questionBank.findMany({
    where: { courseId: firstCourse.id },
    select: { text: true }
  });
  const existingTexts = new Set(existing.map((item) => item.text));

  const toCreate = questions.filter((question) => !existingTexts.has(question.text));

  if (toCreate.length > 0) {
    await prisma.questionBank.createMany({
      data: toCreate.map((question) => ({
        courseId: firstCourse.id,
        text: question.text,
        options: question.options,
        answer: question.answer,
        source: "PDF"
      }))
    });
  }

  const yzmCourse = await prisma.course.findFirst({
    where: { title: "YZM101 Programlamaya Giriş" },
    select: { id: true }
  });

  if (!yzmCourse) {
    return;
  }

  const yzmQuestions = [
    {
      text: 'GPT-4 gibi modellerde kelime yerine "token" kullanilmasinin temel teknik sebebi nedir?',
      options: [
        "Islemci gucunden tasarruf etmek icin rastgele bolme yapmak.",
        "Insanlarin okumasini zorlastirmak icin sifreleme yapmak.",
        "Kelime dagarcigi (vocabulary) boyutunu yonetilebilir tutmak ve bilinmeyen kelime (OOV) sorununu cozumek.",
        "Python ile uyumlulugu artirmak."
      ],
      answer: 2
    },
    {
      text:
        "Veri akisi (streaming) senaryosunda, gelen verinin dagilimini bilmediginiz ve sabit bir bellek boyutunda rastgele bir orneklem olusturmak istediginiz durumda hangi ornekleme algoritmasi en uygundur?",
      options: [
        "Onem Orneklemesi (Importance Sampling)",
        "Sistematik Ornekleme",
        "Rezervuar Ornekleme (Reservoir Sampling)",
        "Katmanli Ornekleme (Stratified Sampling)"
      ],
      answer: 2
    },
    {
      text:
        "Chip Huyen'e gore, bir modelin egitim verisinde hic gormedigi bir bilgiyi uretiyormus gibi davranmasi (ornegin, var olmayan bir API metodunu uydurmasi) hangi tur halusinasyon kategorisine girer?",
      options: [
        "Tutarsizlik (Inconsistency)",
        "Girdi ile Celiski (Faithfulness Error)",
        "Uydurma (Fabrication)",
        "Olgusal Celiski (Factual Contradiction)"
      ],
      answer: 2
    },
    {
      text:
        "CQRS (Command Query Responsibility Segregation) deseninde, Command tarafi ile Query tarafinin veritabanlarinin ayri tutulmasi durumunda karsilasilan en temel zorluk nedir?",
      options: [
        "Karmasik SQL sorgulari.",
        "Yuksek yazma gecikmesi (latency).",
        "Nihai Tutarlilik (Eventual Consistency).",
        "Dusuk okuma performansi."
      ],
      answer: 2
    },
    {
      text:
        "Self-Modeling yetenegine sahip bir ajanda Goal Management bileseni, degisen cevre kosullarina (ornegin kullanicinin butcesinin degismesi) nasil tepki verir?",
      options: [
        "Sadece insan onayi bekler.",
        "Ajani ic hedeflerini dinamik olarak gunceller ve stratejisini yeni kisitlamalara uyacak sekilde yeniden planlar.",
        "Eski plani uygulamaya devam eder.",
        "Hata verip islemi durdurur."
      ],
      answer: 1
    },
    {
      text:
        "Needle in a Haystack testi, uzun baglamli (long-context) modellerin hangi zaafini olcmek icin tasarlanmistir ve Liu et al. (2023) bu test sonucunda modellerin performansi hakkinda ne gozlemlemistir?",
      options: [
        "Baglam uzunlugu arttikca halusinasyon orani artar; performans lineer duser.",
        "Baglamin basinda ve sonunda yer alan bilgiler, ortadakilere gore cok daha iyi hatirlanir (Lost in the Middle).",
        "Baglam uzunlugu 100K tokeni gectiginde model cokup durur.",
        "Modeller sadece sayisal verileri hatirlayabilir."
      ],
      answer: 1
    },
    {
      text:
        "Visitor tasarim deseni, nesne yonelimli programlamada hangi kisitlamayi asmak icin Double Dispatch mekanizmasini kullanir?",
      options: [
        "Tekli kalitim (single inheritance) kisitlamasini.",
        "Cogu dildeki tekli dinamik dispatch kisitlamasini (coklu dispatch yoklugu).",
        "Nesnelerin kopyalanma kisitlamasini.",
        "Private alanlara erisim kisitlamasini."
      ],
      answer: 1
    },
    {
      text:
        "Petastorm kutuphanesinin Spark ve PyTorch entegrasyonundaki temel islevi nedir?",
      options: [
        "Apache Parquet formatindaki verileri, Spark ile islendikten sonra PyTorch DataLoader arayuzune verimli bir sekilde (streaming) beslemek.",
        "Spark cluster'ini yonetmek.",
        "Modeli ONNX formatina cevirmek.",
        "Hiperparametre optimizasyonu yapmak."
      ],
      answer: 0
    },
    {
      text:
        "Bir goruntu siniflandirma sisteminde, egitim verisindeki P(y|x) dagilimi uretim ortamiyla ayni kalirken, P(x) degismistir. Bu durum matematiksel olarak hangi veri kaymasi turu ile ifade edilir?",
      options: [
        "Label Shift (Etiket Kaymasi)",
        "Covariate Shift (Esdegisken Kaymasi)",
        "Feature Drift (Ozellik Kaymasi)",
        "Concept Drift (Kavram Kaymasi)"
      ],
      answer: 1
    },
    {
      text:
        "Bir seyahat planlama ajaninda Contextual Awareness, sadece kullanicinin mevcut istegini anlamanin otesinde neyi kapsar?",
      options: [
        "Global baglami, oturum baglamini ve gorev baglamini hiyerarsik olarak yonetip kararlara entegre etmeyi.",
        "Sadece bir onceki mesaji hatirlamayi.",
        "Sadece kullanicinin ismini bilmeyi.",
        "Veritabanindaki tum ucuslari hafizada tutmayi."
      ],
      answer: 0
    },
    {
      text:
        "Apache Spark uzerinde dagitik derin ogrenme egitimi yapilirken, Project Hydrogen kapsaminda gelistirilen Barrier Execution Mode'un temel islevi nedir?",
      options: [
        "Spark'in GPU bellegini dogrudan yonetmesini saglar.",
        "Tum gorevlerin ayni anda baslatilmasini ve bir engel noktasinda bulusana kadar beklemesini saglayarak gang scheduling'i mumkun kilar.",
        "Verilerin diske yazilmadan dogrudan ag uzerinden aktarilmasini saglar.",
        "MapReduce gorevlerinin daha hizli baslatilmasini saglar."
      ],
      answer: 1
    },
    {
      text:
        "Coordinator-Worker-Delegator (CWD) modelinde, Delegator ajaninin Coordinator'dan farki ve sistemdeki spesifik rolu nedir?",
      options: [
        "Coordinator stratejik planlamayi ve gorev ayristirmayi yaparken; Delegator alt gorevleri uygun Worker ajanlarina atar, yuk dengelemesini saglar ve kaynaklari yonetir.",
        "Delegator sadece hata durumunda devreye girer.",
        "Coordinator plani yapar, Delegator bu plani onaylar.",
        "Coordinator dis dunya ile konusur, Delegator veritabani ile konusur."
      ],
      answer: 0
    }
  ];

  const yzmExisting = await prisma.questionBank.findMany({
    where: { courseId: yzmCourse.id },
    select: { text: true }
  });
  const yzmExistingTexts = new Set(yzmExisting.map((item) => item.text));
  const yzmToCreate = yzmQuestions.filter((question) => !yzmExistingTexts.has(question.text));

  if (yzmToCreate.length > 0) {
    await prisma.questionBank.createMany({
      data: yzmToCreate.map((question) => ({
        courseId: yzmCourse.id,
        text: question.text,
        options: question.options,
        answer: question.answer,
        source: "MANUAL"
      }))
    });
  }

  const [math101, math201] = await Promise.all([
    prisma.course.findFirst({ where: { title: "MAT101" }, select: { id: true } }),
    prisma.course.findFirst({ where: { title: "MAT 201" }, select: { id: true } })
  ]);

  if (math101 && math201) {
    await prisma.course.update({
      where: { id: math201.id },
      data: { prerequisiteId: math101.id }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
