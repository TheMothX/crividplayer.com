/* Kampanjemerking av butikklenker — cookiefri.
 *
 * Leser UTM-parametre fra adressefeltet og skriver dem videre inn i lenkene til
 * Google Play og App Store, slik at butikkene selv kan telle hvor en installasjon
 * kom fra. Ingen cookies, ingen lagring, ingen tredjepart, ingen sporing av
 * personer — vi endrer bare en URL før brukeren klikker på den. Derfor kreves
 * ingen samtykkeboks.
 *
 * Kjeden vi måler:  annonseklikk → denne sida → butikkklikk → installasjon
 * Google Ads måler første ledd. Dette lukker det siste, som er der PokerEye-
 * kampanjen brakk: 25 klikk og ingen mulighet til å vite om noen installerte.
 *
 * Play:  ?referrer=utm_source%3D…%26utm_medium%3D…%26utm_campaign%3D…
 *        → Play Console → Acquisition, filtrerbart på UTM-kilde og kampanje.
 *        Krever INGENTING i appen; Play registrerer det på egen hånd.
 * Apple: ?pt=<provider>&ct=<kampanje>&mt=8
 *        → App Store Connect → Analytics → Acquisition → Campaigns.
 *        ⚠️ pt OG ct må begge være med, ellers dukker kampanjen aldri opp.
 *        Lenken genereres i ASC (Analytics → Acquisition → Campaigns → +).
 *        ⚠️ Apple viser først en kampanje når den har ≥5 nedlastinger på 24 t.
 */
(function () {
  'use strict';

  /* Hentes fra en kampanjelenke generert i App Store Connect. Så lenge den er
   * tom lar vi App Store-lenkene stå urørt — en halv merking ville sett ut som
   * sporing uten å være det, og det er verre enn ingen. */
  var APPLE_PROVIDER_TOKEN = '';

  var FALLBACK = {
    utm_source: 'crividplayer.com',
    utm_medium: 'website',
    utm_campaign: 'organic'
  };

  var q = new URLSearchParams(window.location.search);

  /* Verdiene kommer fra adressefeltet, altså utenfra. Vi bygger dem aldri inn i
   * annet enn spørrestrengen på en hardkodet butikk-URL, men vi begrenser dem
   * likevel: rot i inndata blir ellers til rot i rapporten, og en kampanje som
   * heter tre ulike ting kan ikke summeres. */
  function clean(value, fallback) {
    if (!value) return fallback;
    var v = String(value).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    v = v.replace(/^-+|-+$/g, '').slice(0, 40);
    return v || fallback;
  }

  var utm = {
    source: clean(q.get('utm_source'), FALLBACK.utm_source),
    medium: clean(q.get('utm_medium'), FALLBACK.utm_medium),
    campaign: clean(q.get('utm_campaign'), FALLBACK.utm_campaign)
  };

  /* Apples kampanjetoken tåler 30 tegn. Kilde+kampanje er det som skiller
   * annonsetrafikk fra vanlige besøkende, så det er de to vi tar med. */
  function appleCampaignToken() {
    return (utm.source + '-' + utm.campaign).slice(0, 30);
  }

  function tagPlay(url) {
    url.searchParams.set(
      'referrer',
      'utm_source=' + utm.source +
      '&utm_medium=' + utm.medium +
      '&utm_campaign=' + utm.campaign
    );
    return url;
  }

  function tagApple(url) {
    if (!APPLE_PROVIDER_TOKEN) return url;   // se kommentaren over
    url.searchParams.set('pt', APPLE_PROVIDER_TOKEN);
    url.searchParams.set('ct', appleCampaignToken());
    url.searchParams.set('mt', '8');
    return url;
  }

  function tag(href) {
    var url;
    try {
      url = new URL(href, window.location.href);
    } catch (e) {
      return null;                           // ikke rør noe vi ikke forstår
    }
    if (url.hostname === 'play.google.com') return tagPlay(url);
    if (url.hostname === 'apps.apple.com') return tagApple(url);
    return null;
  }

  function apply() {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var tagged = tag(links[i].getAttribute('href'));
      if (tagged) links[i].href = tagged.toString();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }

  /* Eksponert for testing i node; ubrukt i nettleseren. */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { tag: tag, clean: clean, utm: utm };
  }
})();
