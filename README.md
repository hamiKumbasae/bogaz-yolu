# Boğaz Yolu

İstanbul'da geçen, süreye karşı bir araba yarışı. Tarayıcıda çalışır, kurulum gerekmez. İki mod var:

- **Boğaz Yolu:** Eminönü'nden yola çıkarsın. Her etabın sonundaki yol ayrımında Rumeli yakasını, Anadolu yakasını
  ya da köprüyü seçersin. Süre bitmeden kontrol noktalarına yetişip dört farklı sondan birine ulaşırsın.
- **İstanbul Turu:** Cankurtaran'dan başlayıp yine Cankurtaran'da biten 7 etaplık bir tur. Galata Köprüsü'nden
  Haliç'i, 1. Köprü'den Boğaz'ı geçip Anadolu'ya çıkarsın; Şile Otoyolu ve E-5'ten sonra Avrasya Tüneli ile
  denizin altından Avrupa'ya dönersin.

**Oyna:** https://hamikumbasae.github.io/bogaz-yolu/

Düz HTML, CSS ve JavaScript. Bütün çizimler, müzikler ve pistler bu proje için yapıldı.

Çizimler çizgi film tarzında ve vektördür; oyun ekranın gerçek çözünürlüğünde çizilir, telefonda da büyük
ekranda da pürüzsüz görünür. Yol boyunca camiler, yalılar, Rumelihisarı, Kız Kulesi, Beylerbeyi Sarayı,
vapurlar, simitçiler, çay bahçeleri ve iki Boğaz köprüsü var. Turda bunlara Ayasofya, Sultanahmet Camii, tarihi
surlar, Galata Kulesi, Dolmabahçe, Çamlıca Kulesi ve Çamlıca Camii, metrobüs ve Avrasya Tüneli eklenir.

## Boğaz Yolu rotası

Her oyunda 4 etap sürersin; yol ayrımlarında sola dönersen Rumeli, sağa dönersen Anadolu yakasına (ya da köprüye) gidersin.

```
                     Eminönü – Kabataş
                    ↙                 ↘
        Beşiktaş – Ortaköy       Üsküdar – Kuzguncuk
          ↙          ↘             ↙          ↘
 Bebek – Rumelihisarı    Boğaz Köprüsü    Beylerbeyi – Çengelköy
     ↙        ↘           ↙        ↘          ↙         ↘
Emirgan –     Fatih Sultan Mehmet    Kandilli –      Beykoz –
Sarıyer       Köprüsü                Kanlıca         Anadolu Kavağı
```

Yolculuk sabah başlar, gün batımında biter. Dört son var: **Rumeli Feneri**, **köprüde gün batımı**,
**Kanlıca yoğurdu** ve **Yoros Kalesi**.

## İstanbul Turu rotası

Yol ayrımı yoktur; 7 etabı sırayla sürersin:

1. **Cankurtaran – Sirkeci:** surların yanından Sarayburnu'na; tepede Sultanahmet ve Ayasofya
2. **Eminönü – Galata Köprüsü – Karaköy:** Yeni Cami, oltalarını Haliç'e sarkıtan balıkçılar, Galata Kulesi
3. **Kabataş – Beşiktaş – Ortaköy:** Dolmabahçe Sarayı, Ortaköy Camii
4. **15 Temmuz Şehitler Köprüsü (1. Köprü):** Anadolu yakasına geçiş
5. **Üsküdar – Şile Otoyolu:** Kız Kulesi, sonra otoyolda Çamlıca Kulesi ve Çamlıca Camii
6. **E-5:** solda metrobüs yolu, üst geçitler
7. **Avrasya Tüneli – Kennedy Caddesi:** denizin altından Kazlıçeşme'ye, gün batımında surların yanından
   **Cankurtaran'da bitiş**

Her semtin kendi dokusu var: Sultanahmet'te surların üstünden görünen ahşap konaklar; Eminönü'nde taş hanlar
(kuruyemişçi, baharatçı, lokumcu), Mısır Çarşısı, iskele ve balık-ekmek tekneleri; Eminönü'nden Karaköy'e kadar
yanında T1 tramvayı akan yol; Karaköy'de taş binalar, kafeler ve kruvaziyer gemisi; Ortaköy'de ahşap evler ve
kumpirciler; Üsküdar'da renkli ahşap evler ve çay bahçeleri; Şile Otoyolu ve E-5'te siteler, rezidanslar, plazalar ve
reklam panoları, ufukta gökdelenler.

Rekorlar her mod için ayrı tutulur.

## Kurallar

- Süre bitmeden bir sonraki etabın **kontrol noktasına** ulaş; her kontrol noktası süre ekler.
  Süre bittiğinde araba kayarak kontrol noktasına yetişirse yarış sürer.
- Yolda dolmuş, taksi, otobüs, kamyon ve kurye motoru var. Hızla arkadan çarparsan kaza yaparsın;
  yandan sıyırırsan yalnızca yavaşlarsın.
- Yoldan çıkarsan yavaşlarsın; yol kenarındaki ağaç, direk ve binalara çarpmak kazadır.
  Deniz tarafında korkuluk arabayı tutar.
- Sert virajlarda hız kesmezsen araba dışa doğru savrulur.
- Bitişte kalan her saniye bonus puan getirir. En iyi beş skor adınla kaydedilir.

## Kontroller

| Tuş | İş |
|---|---|
| ← → (ya da A D) | direksiyon |
| ↑, Z, W ya da Boşluk | gaz |
| ↓, X ya da S | fren |
| R | radyo kanalı (Sahil FM, Boğaz FM, Gece FM, kapalı) |
| P / Esc | duraklat |
| M | ses aç / kapat |
| K | telefonu direksiyon yap |
| F | tam ekran |

- **Oyun kolu:** sol çubuk direksiyon (analog), sağ tetik ya da A gaz, sol tetik ya da X fren.
- **Telefonda / tablette:** ekranda direksiyon, GAZ ve FREN tuşları çıkar. *Otomatik gaz* açıkken yalnız
  direksiyon ve fren kullanırsın. *Eğerek sür* açılınca cihazı eğerek dönersin.
- **Telefonu direksiyon yapmak:** menüden *Telefonla oyna*'ya bas, QR kodu telefonla okut. Telefonu yan tutup
  direksiyon gibi çevirirsin; ekranda GAZ ve FREN pedalları var. Eğme desteklenmezse ◀ ▶ tuşları çıkar.
  Eşleştirmeyi PeerJS'in ücretsiz sunucusu yapar; veriler telefonla bilgisayar arasında doğrudan (WebRTC) akar.
- TV ya da projeksiyon için adresin sonuna `?tv` ekle.

## Geliştirme

```
python3 -m http.server      # sonra http://localhost:8000
node tests/core.test.js     # pist, fizik, çarpışma, süre; bir botla Boğaz Yolu'nun 8 rotası ve İstanbul Turu
```

- `src/track.js`: iki mod; Boğaz Yolu'nun 10 etabı ve yol ayrımı ağı, turun 7 etabı. Etaplar bölümlerden oluşur
  (sahil, alçak köprü, asma köprü, otoyol, E-5, tünel). Viraj ve tepe üretimi, yol kenarı nesneleri (tohumlu, hep aynı pist).
- `src/core.js`: yarış kuralları: hız, direksiyon, savrulma, yol dışı, trafik, çarpışma, süre, ayrım seçimi.
  Çizimden bağımsızdır, testler Node'da çalıştırır.
- `src/bot.js`: başlık ekranındaki gösteri sürüşü; testlerde süre dengesini ölçer.
- `src/render.js`: sözde-3D yol çizici (segment izdüşümü, sis, nesne ölçekleme, tünel duvarı ve tavanı, metrobüsler).
- `src/art.js`, `src/endings.js`: vektör çizimler (her nesne ekrandaki boyutuna göre kademeli önbelleğe alınır),
  gün saatine göre renkler, bitiş sahneleri.
- `src/audio.js`: motor sesi, efektler ve üç radyo kanalının özgün müzikleri.
- `src/main.js`: ekranlar, HUD, giriş (klavye, dokunmatik, eğme, oyun kolu), rekorlar.
- `src/remote.js`, `kumanda.html`: telefon direksiyonu.
- `tools/onizle.html`: geliştirirken sahneleri tek tek çizdirmek için.

Her `main` gönderiminde GitHub Actions testleri çalıştırır ve siteyi GitHub Pages'e yayınlar.

## Lisans

Kod MIT lisanslıdır (`LICENSE`). Fredoka yazı tipi SIL Open Font License ile gelir
(`src/fonts/OFL-fredoka.txt`). PeerJS ve qrcode-generator MIT lisanslıdır.
