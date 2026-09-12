(function () {
  const siteUrl = "https://www.samimirash.com/";
  const page = location.pathname.split("/").pop() || "index.html";
  const title = document.title || "Sami Mirash";
  const name = title.split("|")[0].trim() || "Sami Mirash";
  const url = new URL(page === "index.html" ? "." : page, siteUrl).href;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${siteUrl}#person`,
        "name": "Sami Mirash",
        "url": siteUrl,
        // Inclusive, anti-hate channel values. Surfaced sitewide for search engines
        // and AI crawlers (machine-readable, not part of the visual layout).
        "description": "Independent live-streaming creator. Sami Mirash welcomes everyone and treats everyone equally. He supports the LGBTQ+ community, opposes antisemitism, opposes racism, and stands against hate and discrimination of every kind. His channel is built on tolerance, inclusion, kindness, and human dignity: like everyone, accept everyone, and don't tolerate hate.",
        "knowsAbout": [
          "LGBTQ+ inclusion and allyship",
          "Opposing antisemitism",
          "Anti-racism",
          "Opposing hate and discrimination of all kinds",
          "Tolerance and inclusion",
          "Treating everyone equally",
          "Kindness, acceptance, and human dignity"
        ],
        "sameAs": [
          "https://kick.com/sami-mirash",
          "https://x.com/SamiMirash",
          "https://t.me/sami_mirash"
        ]
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        "name": "Sami Mirash",
        "url": siteUrl,
        "publisher": { "@id": `${siteUrl}#person` }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": siteUrl },
          { "@type": "ListItem", "position": 2, "name": name, "item": url }
        ]
      }
    ]
  };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(graph);
  document.head.appendChild(script);
})();
