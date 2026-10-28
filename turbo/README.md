# İstanbul Turbo

Gerçek İstanbul sokaklarında 3D yarış oyunu. İlk rota: **Sahil Yolu**. Cankurtaran'daki Kennedy Caddesi'nden başlıyor; Sarayburnu, Sirkeci, Eminönü, Galata Köprüsü, Karaköy, Tophane, Kabataş, Dolmabahçe, Beşiktaş ve Çırağan'dan geçip Ortaköy'de bitiyor (8,6 km).

Oynamak için: **https://hamikumbasae.github.io/bogaz-yolu/turbo/**

Oyun tarayıcıda çalışır, kurulum gerekmez. Bilgisayarı televizyona bağlayıp tam ekranda (F tuşu) oynamak için tasarlandı.

## Neler var

- Yollar, binalar, kıyı çizgisi, parklar ve tramvay hattı OpenStreetMap verisinden geliyor. Yol genişlikleri şerit sayısına göre hesaplanıyor; yol çizgileri ve yaya geçitleri gerçek yollara çiziliyor.
- Tepeler: Sultanahmet, Beyazıt, Galata, Cihangir, Taksim, Nişantaşı, Yıldız ve Çamlıca gibi tepeler yaklaşık yükseklikleriyle yer alıyor.
- Simgeler: Ayasofya ve diğer camiler (kubbe, yarım kubbe ve minareleriyle), Galata Kulesi, Kız Kulesi, Dolmabahçe Saat Kulesi, Çamlıca Kulesi, ışıklandırmasıyla 15 Temmuz Şehitler Köprüsü. Boğaz'da vapurlar ve gemiler de var.
- Üç zaman dilimi (gündüz, gün batımı, gece) ve yağmur seçeneği. Gece pencereler, dükkânlar, sokak lambaları ve köprü ışıkları yanar. Yağmurda yollar ıslanır ve su birikintileri oluşur.
- Yarış modunda üç rakiple yarışırsın, kontrol noktaları ve sıralama vardır. Serbest sürüşte şehri dilediğin gibi gezersin.
- Trafikte sedan, hatchback, taksi, SUV, İETT tarzı otobüs, dolmuş ve kamyonet bulunur. Araçlara çarpınca savrulurlar. Yakın geçiş yapmak ve drift atmak nitro kazandırır.
- Kumanda desteği (Xbox ya da PlayStation), titreşim, kodla üretilmiş motor ve lastik sesleri.

## Kontroller

| Klavye | Kumanda | İşlev |
|---|---|---|
| W / ↑ | RT | Gaz |
| S / ↓ | LT | Fren, geri |
| A D / ← → | Sol çubuk | Direksiyon |
| Boşluk | X / RB | El freni (drift) |
| Shift / N | A | Nitro |
| C | Y | Kamera (yakın, uzak, kaput) |
| R | Select | Yola dön |
| Esc / P | Start | Duraklat |
| F | | Tam ekran |
| M | | Sesi kapat |

## Grafik kalitesi

Menüdeki **GRAFİK** ayarıyla Düşük, Orta, Yüksek ve Ultra arasında seçim yapılır; değişiklik sayfa yeniden yüklenince uygulanır. Bilgisayar yavaşlarsa oyun çözünürlüğü kendiliğinden düşürür. Adres satırına `?fps` eklenirse kare hızı ekranda görünür.

## Veriyi yeniden üretmek

`data/osm_sahil.json` ve `data/osm_genis.json`, Overpass API'den alınmış ham OpenStreetMap verisidir. Oyunun okuduğu `data/istanbul.json` ve `data/height.bin` dosyaları şu komutla üretilir:

```
pip install shapely numpy scipy mapbox-earcut
python3 tools/build_data.py
```

## Lisanslar

- Harita verisi © OpenStreetMap katkıcıları, ODbL lisansıyla: https://www.openstreetmap.org/copyright
- Three.js © three.js yazarları, MIT lisansıyla (`vendor/three/LICENSE`).
- Oyun kodu bu deponun lisansıyla dağıtılır.
