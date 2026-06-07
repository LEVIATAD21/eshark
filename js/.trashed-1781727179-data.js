/* eShark — Mock product data
 * Realistic Brazilian e-commerce data with multiple offers per product.
 * In production: replace with API/Firestore feed.
 * Each product has 2-3 offers (Shopee, Mercado Livre, Amazon) so the
 * decision engine has real choices to make.
 */
(function (global) {
  'use strict';

  const CATEGORIES = [
    { id: 'eletronicos', name: 'Eletrônicos', icon: '📱' },
    { id: 'audio',       name: 'Áudio',       icon: '🎧' },
    { id: 'casa',        name: 'Casa',        icon: '🏠' },
    { id: 'moda',        name: 'Moda',        icon: '👕' },
    { id: 'beleza',      name: 'Beleza',      icon: '💄' },
    { id: 'esporte',     name: 'Esporte',     icon: '⚽' },
    { id: 'games',       name: 'Games',       icon: '🎮' },
    { id: 'pet',         name: 'Pet',         icon: '🐶' }
  ];

  // Affiliate URL builders (placeholders — substitua os ?aff=xxx pelos seus IDs reais)
  const AFF = {
    shopee: (slug) => `https://shopee.com.br/${slug}?aff_id=ESHARK01`,
    ml:     (slug) => `https://www.mercadolivre.com.br/${slug}?matt_word=ESHARK01`,
    amazon: (slug) => `https://www.amazon.com.br/${slug}?tag=eshark-20`
  };

  // helper to build offer
  const O = (platform, slug, price, shipping, days, rating, sold, perks = []) => ({
    platform, // shopee | ml | amazon
    url: AFF[platform](slug),
    price,         // R$
    shipping,      // R$
    daysToDeliver: days,
    sellerRating: rating,  // 0..5
    sellerSales: sold,
    perks          // ['frete_gratis', 'oficial', 'cupom', 'parcelado']
  });

  const PRODUCTS = [
    {
      id: 'fone-tws-x1',
      name: 'Fone Bluetooth TWS Pro X1 com Cancelamento de Ruído',
      category: 'audio',
      icon: '🎧',
      images: ['🎧', '📦', '🔋'],
      tags: ['mais vendido', 'bluetooth 5.3'],
      reviews: 4.7, sold: 12450, oldPrice: 199.90,
      description: 'Cancelamento ativo de ruído, bateria de 30h, IPX5, controle por toque.',
      offers: [
        O('shopee','fone-tws-x1-i.123.456', 89.90, 0,  4, 4.6,  9800, ['frete_gratis','cupom']),
        O('ml',    'MLB-fone-tws-x1',        99.90, 0,  2, 4.8,  4200, ['frete_gratis','full']),
        O('amazon','dp/B0FAKEX1',           105.00,12,  3, 4.7, 22000, ['prime'])
      ]
    },
    {
      id: 'smartwatch-w8',
      name: 'Smartwatch W8 Pro Tela AMOLED 1.85" GPS',
      category: 'eletronicos',
      icon: '⌚',
      images: ['⌚','📱','💪'],
      tags: ['novo', 'à prova d\'água'],
      reviews: 4.6, sold: 8350, oldPrice: 499.00,
      description: 'Monitoramento de saúde 24/7, GPS, mais de 100 modos esportivos.',
      offers: [
        O('shopee','smartwatch-w8-i.222.111', 229.00, 0,  6, 4.5, 15000, ['frete_gratis']),
        O('ml',    'MLB-w8-pro',              259.90, 0,  3, 4.9, 8800,  ['frete_gratis','full','oficial']),
        O('amazon','dp/B0FAKEW8',             279.00, 0,  4, 4.6, 5200,  ['prime','frete_gratis'])
      ]
    },
    {
      id: 'celular-redmi-13',
      name: 'Smartphone Redmi 13 256GB 8GB RAM Câmera 108MP',
      category: 'eletronicos',
      icon: '📱',
      images: ['📱','📸','🔋'],
      tags: ['top de linha', 'lacrado'],
      reviews: 4.8, sold: 3420, oldPrice: 1899.00,
      description: 'Tela 6.79" 120Hz, bateria 5030mAh, carregamento 33W.',
      offers: [
        O('shopee','redmi-13-i.333.222', 1389.00, 25, 9, 4.4, 2200, ['cupom','parcelado']),
        O('ml',    'MLB-redmi-13',       1419.00,  0, 3, 4.9, 9100, ['frete_gratis','full','oficial','parcelado']),
        O('amazon','dp/B0REDMI13',       1499.00,  0, 5, 4.6, 4400, ['prime','frete_gratis','parcelado'])
      ]
    },
    {
      id: 'air-fryer-15l',
      name: 'Air Fryer Forno 15L Digital com Receitas',
      category: 'casa',
      icon: '🍳',
      images: ['🍳','🔥','🥘'],
      tags: ['família', 'econômica'],
      reviews: 4.7, sold: 5500, oldPrice: 599.00,
      description: 'Capacidade 15L, painel digital, 8 funções, baixo consumo.',
      offers: [
        O('shopee','airfryer-15l-i.444.333', 349.00, 30, 10, 4.5, 6200, ['cupom']),
        O('ml',    'MLB-air-fryer-15l',      379.00,  0,  4, 4.7, 3300, ['frete_gratis','full']),
      ]
    },
    {
      id: 'mouse-gamer-rgb',
      name: 'Mouse Gamer RGB 12000 DPI 7 Botões',
      category: 'games',
      icon: '🖱️',
      images: ['🖱️','💡','🎮'],
      tags: ['gamer'],
      reviews: 4.5, sold: 18000, oldPrice: 129.00,
      description: 'Sensor óptico 12000 DPI, RGB customizável, 7 botões programáveis.',
      offers: [
        O('shopee','mouse-gamer-rgb-i.555.444', 49.90, 0,  5, 4.5, 14000, ['frete_gratis','cupom']),
        O('ml',    'MLB-mouse-gamer',           59.90, 0,  2, 4.7, 6600,  ['frete_gratis','full']),
        O('amazon','dp/B0MOUSEG',               69.00, 0,  3, 4.6, 9800,  ['prime'])
      ]
    },
    {
      id: 'tenis-corrida-x',
      name: 'Tênis de Corrida Ultra Light Masculino',
      category: 'esporte',
      icon: '👟',
      images: ['👟','🏃','💨'],
      tags: ['leve', 'respirável'],
      reviews: 4.6, sold: 7800, oldPrice: 299.00,
      description: 'Solado EVA, palmilha em gel, malha respirável.',
      offers: [
        O('shopee','tenis-ultra-i.666.555', 159.00, 0, 7, 4.4, 5400, ['frete_gratis']),
        O('ml',    'MLB-tenis-ultra',       179.00, 0, 3, 4.7, 2100, ['frete_gratis','full'])
      ]
    },
    {
      id: 'cafeteira-cap',
      name: 'Cafeteira Elétrica 38 Xícaras Inox',
      category: 'casa',
      icon: '☕',
      images: ['☕','🫖','🔥'],
      tags: ['família'],
      reviews: 4.5, sold: 4200, oldPrice: 249.00,
      description: 'Capacidade 38 xícaras, jarra de vidro, sistema corta-pingo.',
      offers: [
        O('shopee','cafeteira-i.777.666', 139.00, 18, 9, 4.4, 3800, ['cupom']),
        O('ml',    'MLB-cafeteira-38',    159.00,  0, 3, 4.6, 2900, ['frete_gratis','full']),
        O('amazon','dp/B0CAFE38',         169.00,  0, 4, 4.5, 1500, ['prime','frete_gratis'])
      ]
    },
    {
      id: 'console-portatil',
      name: 'Console Portátil Retrô 20.000 Jogos Tela 5"',
      category: 'games',
      icon: '🎮',
      images: ['🎮','📺','🕹️'],
      tags: ['retrô'],
      reviews: 4.4, sold: 6300, oldPrice: 399.00,
      description: 'Tela 5", saída HDMI, 2 controles, sistema retrô completo.',
      offers: [
        O('shopee','console-retro-i.888.777', 199.00, 0, 8, 4.3, 5800, ['frete_gratis','cupom']),
        O('ml',    'MLB-console-retro',       229.00, 0, 3, 4.6, 1700, ['frete_gratis','full'])
      ]
    },
    {
      id: 'kit-skincare',
      name: 'Kit Skincare Vitamina C + Ácido Hialurônico',
      category: 'beleza',
      icon: '💄',
      images: ['💄','✨','💧'],
      tags: ['queridinho'],
      reviews: 4.8, sold: 9200, oldPrice: 189.00,
      description: 'Sérum + hidratante + protetor. Pele iluminada em 14 dias.',
      offers: [
        O('shopee','skincare-kit-i.999.888', 89.00, 0,  6, 4.7, 7200, ['frete_gratis']),
        O('ml',    'MLB-skincare-kit',       99.90, 0,  2, 4.9, 3100, ['frete_gratis','full','oficial'])
      ]
    },
    {
      id: 'racao-pet-15kg',
      name: 'Ração Premium Cães Adultos 15kg',
      category: 'pet',
      icon: '🐶',
      images: ['🐶','🍖','🦴'],
      tags: ['premium'],
      reviews: 4.7, sold: 3100, oldPrice: 219.00,
      description: 'Ração super premium, com proteínas nobres e probióticos.',
      offers: [
        O('shopee','racao-15kg-i.111.999', 149.00, 25, 7, 4.5, 1900, ['cupom']),
        O('ml',    'MLB-racao-15kg',       169.00,  0, 3, 4.8, 4400, ['frete_gratis','full'])
      ]
    },
    {
      id: 'jaqueta-corta-vento',
      name: 'Jaqueta Corta-Vento Impermeável Unissex',
      category: 'moda',
      icon: '🧥',
      images: ['🧥','🌧️','💨'],
      tags: ['inverno'],
      reviews: 4.5, sold: 5400, oldPrice: 249.00,
      description: 'Tecido impermeável, capuz removível, bolsos com zíper.',
      offers: [
        O('shopee','jaqueta-i.222.000', 119.00, 0, 7, 4.4, 4200, ['frete_gratis']),
        O('ml',    'MLB-jaqueta',       139.00, 0, 3, 4.6, 1800, ['frete_gratis','full'])
      ]
    },
    {
      id: 'caixa-som-bluetooth',
      name: 'Caixa de Som Bluetooth Portátil 40W IPX7',
      category: 'audio',
      icon: '🔊',
      images: ['🔊','🎵','💧'],
      tags: ['à prova d\'água'],
      reviews: 4.6, sold: 8800, oldPrice: 349.00,
      description: '40W RMS, 16h de bateria, à prova d\'água IPX7, TWS.',
      offers: [
        O('shopee','caixa-som-i.333.000', 189.00, 0, 6, 4.5, 6800, ['frete_gratis','cupom']),
        O('ml',    'MLB-caixa-som',       209.00, 0, 2, 4.7, 4400, ['frete_gratis','full']),
        O('amazon','dp/B0CXSOM',          229.00, 0, 4, 4.6, 3200, ['prime'])
      ]
    }
  ];

  const REVIEWS_DB = {
    'fone-tws-x1': [
      { user:'Carlos M.',  stars:5, txt:'Som incrível, bateria dura mesmo. Chegou rápido!' },
      { user:'Ana P.',     stars:5, txt:'Vale cada centavo. Cancelamento de ruído surpreendeu.' },
      { user:'Lucas T.',   stars:4, txt:'Bom, mas a caixinha é pequena. No mais, top.' }
    ],
    'smartwatch-w8': [
      { user:'Joana S.',   stars:5, txt:'Lindo, bateria dura 5 dias. Recomendo.' },
      { user:'Pedro H.',   stars:4, txt:'GPS funciona bem na corrida. App é simples.' }
    ],
    'celular-redmi-13': [
      { user:'Marina V.',  stars:5, txt:'Excelente custo-benefício. Câmera surpreendeu.' }
    ]
  };

  function getReviews(productId) {
    return REVIEWS_DB[productId] || [
      { user:'Cliente verificado', stars:5, txt:'Produto chegou conforme anunciado, recomendo.' },
      { user:'Cliente verificado', stars:4, txt:'Bom produto pelo preço. Entrega no prazo.' }
    ];
  }

  function getById(id) { return PRODUCTS.find(p => p.id === id); }
  function search(q, opts = {}) {
    const t = (q || '').toLowerCase().trim();
    let list = PRODUCTS;
    if (t) list = list.filter(p => (p.name + ' ' + p.tags.join(' ') + ' ' + p.category).toLowerCase().includes(t));
    if (opts.category) list = list.filter(p => p.category === opts.category);
    return list;
  }

  global.Data = {
    CATEGORIES, PRODUCTS, AFF,
    getById, search, getReviews,
    platformLabel: (p) => ({ shopee:'Shopee', ml:'Mercado Livre', amazon:'Amazon' })[p] || p,
    platformColor: (p) => ({ shopee:'#ee4d2d', ml:'#fff159', amazon:'#ff9900' })[p] || '#888'
  };
})(window);
