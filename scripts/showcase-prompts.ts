/**
 * Text-to-image prompts for the Midsummer showcase. Every person is fictional
 * and generated; prompts ask for no likeness, logo, brand or text. Each prompt
 * stays under 800 characters (checked in tests/showcase-scripts.test.ts).
 */
export const NEGATIVE = "text, letters, logo, watermark, brand name, label, signature, celebrity likeness, famous person, child, nudity, extra limbs, distorted hands, cropped head, cropped feet, multiple people, busy background";

const PERSON = (who: string) =>
  `Full-length studio photograph of one fictional adult ${who}, standing straight and facing the camera, arms relaxed at the sides, neutral expression, wearing a plain grey crew-neck t-shirt and plain black trousers with black shoes, entire body visible from the top of the head to the shoes with space above and below, centred, plain light grey seamless backdrop, soft even studio light, sharp focus, photorealistic, natural skin texture, no accessories.`;

const GARMENT = (what: string) =>
  `Catalogue product photograph of ${what}, shown on an invisible ghost mannequin, front view, whole garment in frame, plain white background, soft even light, sharp fabric detail, photorealistic, no person, no hanger, no logo, no text, no label.`;

export const PERFORMER_PROMPTS: Record<string, string> = {
  "p-elliot-body": PERSON("man in his late thirties, light olive skin, short dark brown hair, clean-shaven, medium build, average height"),
  "p-ama-body": PERSON("woman in her early thirties, deep brown skin, shoulder-length black natural hair pulled back, slim build, tall"),
  "p-lena-body": PERSON("woman in her mid twenties, East Asian, straight black hair to the shoulders, petite build, short"),
  "p-grace-body": PERSON("woman in her late twenties, fair skin with freckles, long auburn hair, slender build, very tall"),
  "p-rafael-body": PERSON("man in his late twenties, Latino, warm tan skin, short wavy black hair, light stubble, medium build"),
  "p-tom-body": PERSON("man in his early thirties, pale skin, short blond hair, clean-shaven, tall athletic build"),
  "p-juniper-body": PERSON("woman in her early twenties, light brown skin, short curly dark hair, slight build, short"),
  "p-marcus-body": PERSON("man in his forties, dark brown skin, shaved head, short beard, broad heavy build"),
  "p-ruth-body": PERSON("woman in her fifties, light skin, short grey hair, no glasses, medium build"),
  "p-sam-body": PERSON("man in his early twenties, South Asian, medium brown skin, short black hair, slim build"),
};

export const GARMENT_PROMPTS: Record<string, string> = {
  "m-evening-base": GARMENT("a man's white formal evening shirt with a wing collar worn with plain black evening trousers, as one outfit"),
  "m-black-jacket": GARMENT("a man's black single-breasted dinner jacket with black satin peak lapels, 1920s cut"),
  "m-navy-jacket": GARMENT("a man's midnight-navy dinner jacket with a navy satin shawl collar, 1920s cut"),
  "m-velvet-cape": GARMENT("a long midnight-navy velvet evening cape that falls to the knee, with a high collar"),
  "m-ivory-gown": GARMENT("an ivory 1920s drop-waist evening gown covered in ivory and gold glass beading, sleeveless, knee to mid-calf length"),
  "m-silver-gown": GARMENT("a silver-green bias-cut silk slip gown, 1920s style, thin straps, ankle length"),
  "m-rose-dress": GARMENT("a dusty-rose cotton 1920s drop-waist day dress with short sleeves and a pleated skirt, mid-calf length"),
  "m-cream-cardigan": GARMENT("a cream cable-knit wool cardigan, long sleeves, buttoned front"),
  "m-green-waistcoat": GARMENT("a forest-green wool waistcoat over a white collarless shirt with rolled sleeves, as one upper-body outfit"),
  "m-tweed-suit": GARMENT("a brown herringbone tweed three-piece work suit, 1920s style, jacket and trousers"),
  "m-work-shirt": GARMENT("a grey cotton work shirt with plain grey work trousers, as one outfit"),
  "m-apron": GARMENT("a long brown canvas carpenter's work apron with front pockets"),
  "h-black-jacket": GARMENT("a man's black dinner jacket with black satin notch lapels"),
  "h-gold-gown": GARMENT("a gold beaded 1920s evening gown with an ivory underlayer, sleeveless, mid-calf length"),
  "h-ivory-stole": GARMENT("an ivory satin evening stole wrap, long and soft"),
  "h-sheer-cape": GARMENT("a sheer silver organza cape, floor length, light and translucent"),
  "b-blue-dress": GARMENT("a powder-blue 1920s drop-waist day dress, long sleeves, ankle length"),
  "b-champagne-gown": GARMENT("a champagne satin 1920s evening gown, long, with a low back"),
  "b-evening-base": GARMENT("a man's new white formal evening shirt with plain black evening trousers, as one outfit"),
  "s-ivory-gown": GARMENT("an ivory beaded 1920s evening gown, slightly worn vintage piece, sleeveless"),
  "s-white-gown": GARMENT("a white chiffon 1920s evening gown, vintage, loose fit"),
  "s-ivory-dress": GARMENT("an ivory cotton lawn 1920s day dress, long, with lace trim, vintage"),
  "s-brown-coat": GARMENT("a brown waxed-cotton work coat, knee length, vintage"),
};

export const ALL_PROMPTS: Record<string, string> = { ...PERFORMER_PROMPTS, ...GARMENT_PROMPTS };
