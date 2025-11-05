turtch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { kullanici_adi, kullanici_ismi, image_url } = req.body;

  if (!kullanici_adi || !kullanici_ismi || !image_url) {
    return res.status(400).json({ error: "Eksik alanlar!" });
  }

  try {
    // OCR.space API çağrısı
    const formData = new URLSearchParams();
    formData.append("apikey", process.env.OCR_API_KEY);
    formData.append("url", image_url);
    formData.append("language, "tur"); // İngilizce ve Türkçe destek
    formData.append("OCREngine", "2");
    formData.append("isOverlayRequired", "false");

    const ocrRes = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData
    });

    const ocrJson = await ocrRes.json();

    if (ocrJson.IsErroredOnProcessing) {
      return res.status(500).json({ error: ocrJson.ErrorMessage || "OCR Hatası" });
    }

    const ocrText = ocrJson.ParsedResults[0].ParsedText.toUpperCase();
    const usernameUpper = kullanici_adi.toUpperCase();
    const channelUpper = kullanici_ismi.toUpperCase();

    // Kanal adı benzerlik oranı
    const similarity = (a, b) => {
      const maxLen = Math.max(a.length, b.length);
      let same = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] === b[i]) same++;
      }
      return same / maxLen;
    };
    const channel_ratio = similarity(channelUpper, ocrText);
    const username_match = ocrText.includes(usernameUpper);

    // Abone kelimeleri kontrolü
    const sub_keywords = ["ABONE OLUNDU", "SUBSCRIBED", "ABONELİK VAR"];
    const sub_match = sub_keywords.some(k => ocrText.includes(k.toUpperCase()));

    let result, meta;
    if ((channel_ratio >= 0.7 || username_match) && sub_match) {
      const matched_words = [];
      if (channel_ratio >= 0.7) matched_words.push(kullanici_ismi);
      if (username_match) matched_words.push(kullanici_adi);
      result = "ABONE";
      meta = {
        match_score: Math.max(channel_ratio, username_match ? 1 : 0),
        matched_words,
        found_sub_keyword: true
      };
    } else {
      result = "ABONE DEĞİL";
      meta = {
        match_score: Math.max(channel_ratio, username_match ? 1 : 0),
        matched_words: [],
        found_sub_keyword: sub_match
      };
    }

    return res.status(200).json({ result, meta });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
}
