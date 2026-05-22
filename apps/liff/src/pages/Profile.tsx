import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface Review {
  id: string;
  customerName: string;
  customerImage: string | null;
  badge: string | null;
  menuName: string;
  text: string;
  likes: number;
}

interface ProfileMenu {
  id: string;
  name: string;
  description: string;
  image: string | null;
  badge: string | null;
  tag: string | null;
  originalPrice: number | null;
  price: number;
  durationMinutes: number;
}

interface ProfileData {
  name: string;
  role: string;
  bio: string;
  profileImage: string;
  heroImage: string;
  location: string;
  experience: string;
  stats: { likes: number; followers: number; reviews: number };
  features: string[];
  reviews: Review[];
  menus: ProfileMenu[];
}

const mockProfile: ProfileData = {
  name: '新田 友里',
  role: 'ダイエットカウンセラー',
  bio: 'ダイエットカウンセラー歴18年。我慢も食事制限も激しい運動も必要ありません。年齢のせいと諦めていた体重にも原因があります。40代・50代からでも遅くない🌿',
  profileImage: 'https://www.lislim.jp/wp-content/uploads/IMG_8974-scaled.jpg',
  heroImage: 'https://www.lislim.jp/wp-content/uploads/IMG_5139.jpg',
  location: '沖縄県那覇市首里...',
  experience: 'エステティシャン歴18年',
  stats: { likes: 108, followers: 1014, reviews: 153 },
  features: ['しっかり相談', 'ご予約優先', 'ダイエット', '完全予約のマンツーマン', 'ボディケア', '美容', '産後ダイエット'],
  reviews: [
    {
      id: '1',
      customerName: 'ひらた',
      customerImage: null,
      badge: '長く来店しているお客様のレビュー',
      menuName: '【リピーター様】アフター...',
      text: '久しぶりにお会いして近況報告できてよかったです^^\n今回も食事のアドバイスありがとうございました\n体脂肪を維持できるようにします...',
      likes: 0,
    },
    {
      id: '2',
      customerName: '城田勝江',
      customerImage: null,
      badge: '頻繁に来店しているお客様のレビュー',
      menuName: '【リピーター様】予約枠',
      text: 'いつもありがとうございます。\n休息のひと時。\n笑顔に癒されます。\nこれからもよろしくお願い致します😊',
      likes: 0,
    },
    {
      id: '3',
      customerName: '當山和美',
      customerImage: null,
      badge: '頻繁に来店しているお客様のレビュー',
      menuName: '【リピーター様】予約枠',
      text: '体重減少がうまくいかなくて、不安になった時も丁寧にサポートしてくれて感謝しています。カウンセリングの際も毎回褒めながらアドバイスしてくれるので、モチベーションがあがります。(^-^)...',
      likes: 2,
    },
  ],
  menus: [
    {
      id: '1',
      name: 'ダイエットから卒業【ご新規様】初回ダイエット診断カウンセリング',
      description: '【ご新規様】ダイエットから卒業！ カウンセリング・測定痩せたい目的と習慣を軸に あなたがリバウンドしない方法を診断します。 押し売り/勧誘はございません',
      image: 'https://www.lislim.jp/wp-content/uploads/IMG_5139.jpg',
      badge: 'オススメ',
      tag: '新規のみ',
      originalPrice: 12580,
      price: 0,
      durationMinutes: 60,
    },
    {
      id: '2',
      name: '【ご新規様】初回ダイエットカウンセリングと体験',
      description: '【ご新規様】初回ダイエットカウンセリング診断+お悩みに合わせてオーダーメイド施術(ボディケア・ハーブ蒸し等)なりたい自分をイメージしてみて',
      image: 'https://www.lislim.jp/wp-content/uploads/IMG_7795-scaled.jpg',
      badge: 'クーポン',
      tag: '新規のみ',
      originalPrice: 35000,
      price: 21980,
      durationMinutes: 90,
    },
    {
      id: '3',
      name: '【ご新規様】オンライン初回ダイエット診断カウンセリング',
      description: '【オンライン初回カウンセリング】話すだけで痩せるダイエット/なりたいスタイルへ導く為の診断 こちらの枠はオンライン限定の内容です',
      image: 'https://www.lislim.jp/wp-content/uploads/IMG_7437.png',
      badge: 'クーポン',
      tag: '新規のみ',
      originalPrice: null,
      price: 0,
      durationMinutes: 30,
    },
    {
      id: '4',
      name: '【リピーター様】予約枠',
      description: '既存のお客様優先枠※',
      image: 'https://www.lislim.jp/wp-content/uploads/IMG_5139.jpg',
      badge: '定番メニュー',
      tag: '会員のみ',
      originalPrice: null,
      price: 0,
      durationMinutes: 60,
    },
  ],
};

function badgeColor(badge: string): string {
  switch (badge) {
    case 'オススメ': return 'bg-pink-500';
    case 'クーポン': return 'bg-pink-500';
    case '定番メニュー': return 'bg-rose-400';
    default: return 'bg-gray-500';
  }
}

function tagColor(tag: string): string {
  switch (tag) {
    case '新規のみ': return 'bg-green-500';
    case '会員のみ': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
}

export default function Profile() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [p] = useState(mockProfile);

  function goToBooking() {
    navigate({ pathname: '/booking', search });
  }

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Hero */}
      <div className="relative">
        <div
          className="h-56 bg-cover bg-center"
          style={{ backgroundImage: `url(${p.heroImage})` }}
        >
          <div className="absolute inset-0 bg-black/30" />
        </div>
        <div className="relative -mt-16 flex flex-col items-center">
          <img
            src={p.profileImage}
            alt={p.name}
            className="w-28 h-28 rounded-full border-4 border-white object-cover shadow-lg"
          />
          <h1 className="text-xl font-bold mt-2">{p.name}</h1>
          <div className="flex gap-4 text-sm text-gray-500 mt-1">
            <span>♡ {p.stats.likes}</span>
            <span>👥 {p.stats.followers}</span>
            <span>💬 {p.stats.reviews}</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-2">
          <span>📍 {p.location}</span>
          <span>✂️ {p.experience}</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{p.bio}</p>
        <div className="flex gap-3 mt-4">
          <button className="flex-1 border-2 border-pink-400 text-pink-500 rounded-full py-2.5 font-semibold text-sm">
            メッセージする
          </button>
          <button
            onClick={goToBooking}
            className="flex-1 bg-gradient-to-r from-pink-400 to-pink-500 text-white rounded-full py-2.5 font-semibold text-sm shadow"
          >
            空席を確認してみる
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white mx-4 mt-3 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {p.features.map((f) => (
            <span key={f} className="px-3 py-1 border rounded-full text-xs text-gray-600">
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="bg-white mx-4 mt-3 rounded-xl p-4 shadow-sm">
        <h2 className="text-xl font-bold mb-1">
          お客様からのレビュー
          <span className="text-pink-500 text-base ml-1">({p.stats.reviews}件)</span>
        </h2>
        <div className="space-y-3 mt-3">
          {p.reviews.map((r) => (
            <div key={r.id} className="border rounded-xl overflow-hidden flex">
              <div className="flex-1 p-3">
                <div className="text-xs text-gray-400 mb-1">メニュー/ {r.menuName}</div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                    {r.customerImage && <img src={r.customerImage} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <span className="font-medium text-sm">{r.customerName}</span>
                </div>
                {r.badge && (
                  <span className="inline-block bg-pink-500 text-white text-xs px-2 py-0.5 rounded mb-1">
                    {r.badge}
                  </span>
                )}
                <p className="text-sm text-gray-700 whitespace-pre-line line-clamp-3 mt-1">{r.text}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                  <span>♡</span>
                  <span>{r.likes}ステキ!</span>
                </div>
              </div>
              <div className="w-28 bg-gray-100 flex items-end justify-center">
                <span className="text-xs text-gray-400 pb-2">レビューを詳しくみる</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Menus */}
      <div className="bg-white mx-4 mt-3 rounded-xl p-4 shadow-sm">
        <h2 className="text-xl font-bold mb-1">メニュー料金</h2>
        <div className="space-y-3 mt-3">
          {p.menus.map((m) => (
            <div key={m.id} className="border rounded-xl overflow-hidden">
              <div className="relative">
                {m.badge && (
                  <span className={`absolute top-0 left-0 ${badgeColor(m.badge)} text-white text-xs px-3 py-1 rounded-br-xl font-bold z-10`}>
                    {m.badge}
                  </span>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-bold text-sm leading-snug mb-2">{m.name}</h3>
                <div className="flex gap-3">
                  {m.image && (
                    <img src={m.image} alt="" className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm mb-1">
                      {m.originalPrice !== null && (
                        <span className="line-through text-gray-400 mr-1">
                          {m.originalPrice.toLocaleString()}円
                        </span>
                      )}
                      {m.originalPrice !== null && <span className="mr-1">→</span>}
                      <span className="font-bold">
                        {m.price === 0 ? '0円' : `${m.price.toLocaleString()}円`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-3">{m.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  {m.tag && (
                    <span className={`${tagColor(m.tag)} text-white text-xs px-2 py-0.5 rounded`}>
                      {m.tag}
                    </span>
                  )}
                  <button
                    onClick={goToBooking}
                    className="text-pink-500 text-xs font-medium ml-auto"
                  >
                    タップして空席を確認 ＞
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex gap-2 p-3 z-50">
        <button className="flex-1 border-2 border-emerald-400 text-emerald-500 rounded-lg py-3 font-semibold text-sm">
          メッセージする
        </button>
        <button
          onClick={goToBooking}
          className="flex-1 bg-gradient-to-r from-pink-400 to-pink-500 text-white rounded-lg py-3 font-semibold text-sm shadow"
        >
          空席を確認してみる
        </button>
      </div>
    </div>
  );
}
