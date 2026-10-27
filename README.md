# Boğaz Yolu

İstanbul Boğazı'nın sahil yolunda geçen, süreye karşı bir araba yarışı. Tarayıcıda çalışır, kurulum gerekmez.
Eminönü'nden yola çıkarsın. Her etabın sonundaki yol ayrımında Rumeli yakasını, Anadolu yakasını ya da köprüyü
seçersin. Süre bitmeden kontrol noktalarına yetişip dört farklı sondan birine ulaşırsın.

**Oyna:** https://hamikumbasae.github.io/bogaz-yolu/

Düz HTML, CSS ve JavaScript. Bütün çizimler, müzikler ve pistler bu proje için yapıldı.

Çizimler çizgi film tarzında ve vektördür; oyun ekranın gerçek çözünürlüğünde çizilir, telefonda da büyük
ekranda da pürüzsüz görünür. Yol boyunca camiler, yalılar, Rumelihisarı, Kız Kulesi, Beylerbeyi Sarayı,
vapurlar, simitçiler, çay bahçeleri ve iki Boğaz köprüsü var.

## Rota

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
node tests/core.test.js     # pist, fizik, çarpışma, süre ve bir botla 8 rotanın hepsi
```

- `src/track.js`: 10 etap, yol ayrımı ağı, viraj ve tepe üretimi, yol kenarı nesneleri (tohumlu, hep aynı pist).
- `src/core.js`: yarış kuralları: hız, direksiyon, savrulma, yol dışı, trafik, çarpışma, süre, ayrım seçimi.
  Çizimden bağımsızdır, testler Node'da çalıştırır.
- `src/bot.js`: başlık ekranındaki gösteri sürüşü; testlerde süre dengesini ölçer.
- `src/render.js`: sözde-3D yol çizici (segment izdüşümü, sis, nesne ölçekleme).
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
