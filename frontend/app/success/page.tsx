"use client";

import React, { useEffect, useState } from "react";

type SuccessPageProps = {
  searchParams?: {
    orderCode?: string;
  };
};

function SuccessPage({ searchParams }: SuccessPageProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsPopupOpen(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen px-6 py-12 flex items-center justify-center">
      {isPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="menu-ticket w-full max-w-md overflow-hidden shadow-2xl animate-[popIn_220ms_ease-out]">
            <div className="bg-linear-to-br from-emerald-500 via-teal-500 to-cyan-600 px-5 py-4 text-white">
              <p className="text-xs uppercase tracking-[0.35em] opacity-80">
                Notification
              </p>
              <h2 className="mt-2 text-2xl font-serif">
                Thanh toán thành công
              </h2>
            </div>

            <div className="space-y-3 px-5 py-5 text-sm leading-6">
              <p>
                Đơn hàng
                {searchParams?.orderCode
                  ? ` #${searchParams.orderCode}`
                  : ""}{" "}
                đã được ghi nhận và đang đợi bot đồng bộ trạng thái.
              </p>
              <button
                type="button"
                onClick={() => setIsPopupOpen(false)}
                className="modern-button modern-button-primary w-full"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="menu-ticket w-full max-w-xl overflow-hidden">
        <div className="bg-linear-to-br from-emerald-500 via-teal-500 to-cyan-600 px-6 py-5 text-white">
          <p className="text-sm uppercase tracking-[0.35em] opacity-80">
            Payment complete
          </p>
          <h1 className="mt-2 text-3xl font-serif">Thanh toán thành công</h1>
        </div>

        <div className="space-y-4 px-6 py-8 text-base leading-7">
          <p>
            Đơn hàng
            {searchParams?.orderCode ? ` #${searchParams.orderCode}` : ""} đã
            được ghi nhận. Hệ thống đang đồng bộ trạng thái với chatbot Telegram
            của bạn.
          </p>
          <p className="text-sm text-black/60">
            Bạn có thể quay lại Telegram để theo dõi trạng thái chế biến hoặc
            đợi bot nhắn xác nhận tự động.
          </p>
        </div>
      </section>
    </main>
  );
}

export default SuccessPage;
