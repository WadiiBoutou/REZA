import React from 'react';
import { X, Download, CheckCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { formatMoroccoDate, formatMoroccoTime } from '../../lib/utils';

type Service = {
  name: string;
  duration: string;
  price?: number;
};

type BookingData = {
  firstName: string;
  lastName: string;
  date: string;
  time: string;
  totalPrice: number;
  totalDuration: string;
  paymentMethod?: 'establishment' | 'card';
  cardNumber?: string;
};

type ParticipantSummary = {
  name: string;
  services: Service[];
  subtotal: number;
  time?: string;
};

type ReceiptProps = {
  bookingData: BookingData;
  selectedServices: Service[];
  receiptSummary?: {
    participants: ParticipantSummary[];
    grandTotal: number;
  } | null;
  onClose: () => void;
  referenceNumber?: string;
  salonName?: string;
  clientName?: string;
  salonAddress?: string;
  salonCity?: string;
  salonPhone?: string;
  salonIce?: string;
  salonRc?: string;
  salonIf?: string;
};

const Receipt: React.FC<ReceiptProps> = ({
  bookingData,
  selectedServices,
  receiptSummary,
  onClose,
  referenceNumber,
  salonName,
  clientName,
  salonAddress,
  salonCity,
  salonPhone,
  salonIce,
  salonRc,
  salonIf,
}) => {
  const receiptNumber = referenceNumber || `REF${Date.now().toString(36).toUpperCase().slice(-9)}`;
  const displaySalonName = salonName || 'Salon';
  const displaySalonAddress = salonAddress || '';
  const displaySalonCity = salonCity || '';
  const displaySalonPhone = salonPhone || '';
  const displayClientName = clientName || `${bookingData.firstName} ${bookingData.lastName}`;
  const displayIce = salonIce || '';
  const displayRc = salonRc || '';
  const displayIf = salonIf || '';
  const isGroup = receiptSummary && receiptSummary.participants.length > 1;
  const grandTotal = receiptSummary?.grandTotal ?? bookingData.totalPrice;

  const currentDate = formatMoroccoDate(new Date(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const currentTime = formatMoroccoTime(new Date(), {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleDownload = async () => {
    const receiptElement = document.getElementById('receipt-content');
    if (!receiptElement) return;

    try {
      const canvas = await html2canvas(receiptElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `recu-${receiptNumber}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      console.error('Error generating image:', error);
    }
  };

  const renderServices = (services: Service[]) =>
    services.map((service, idx) => (
      <div key={idx} className="mb-2">
        <div className="flex justify-between">
          <span className="flex-1">{service.name}</span>
          <span className="ml-2">{service.price}.00</span>
        </div>
        <div className="text-black text-[10px]">{service.duration}</div>
      </div>
    ));

  return (
    <div className="fixed inset-0 z-50 bg-[#f5f7f3] overflow-y-auto">
      <div className="bg-[#101828] text-white py-6 px-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <CheckCircle className="w-6 h-6" />
          <h2 className="text-2xl font-semibold">Réservation enregistrée !</h2>
        </div>
        <p className="text-white/90 text-sm">
          Votre demande a été envoyée. L&apos;établissement confirmera bientôt votre rendez-vous.
          {bookingData.paymentMethod === 'card' && ' Vous recevrez une confirmation par email.'}
        </p>
      </div>

      <div className="fixed top-20 right-4 flex gap-2 z-10">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-white shadow-md rounded-full text-gray-700 hover:bg-gray-50 transition-colors"
          aria-label="Télécharger"
        >
          <Download className="w-4 h-4" />
          <span className="text-sm font-medium">Télécharger</span>
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white shadow-md rounded-full text-gray-600 hover:text-gray-900 transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white w-full max-w-sm mx-auto pt-8 pb-12 px-6">
        <div
          id="receipt-content"
          className="font-mono text-xs space-y-4 max-w-[320px] mx-auto text-black p-6 rounded-lg"
        >
          <div className="text-center border-b border-black pb-3">
            <h1 className="text-lg font-bold mb-1">RZ</h1>
            {displaySalonName && <h1 className="text-sm font-bold mb-1">{displaySalonName}</h1>}
            {displaySalonAddress && <p className="text-black">{displaySalonAddress}</p>}
            {displaySalonCity && <p className="text-black">{displaySalonCity}</p>}
            {displaySalonPhone && <p className="text-black">Tel: {displaySalonPhone}</p>}
          </div>

          <div className="border-b border-black pb-3">
            <div className="flex justify-between mb-1">
              <span>RECU N°</span>
              <span>{receiptNumber}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>DATE</span>
              <span>{currentDate}</span>
            </div>
            <div className="flex justify-between">
              <span>HEURE</span>
              <span>{currentTime}</span>
            </div>
          </div>

          <div className="border-b border-black pb-3">
            <div className="flex justify-between mb-1">
              <span>CLIENT</span>
              <span className="text-right">{displayClientName}</span>
            </div>
            {isGroup && (
              <div className="flex justify-between text-[10px]">
                <span>PERSONNES</span>
                <span>{receiptSummary!.participants.length}</span>
              </div>
            )}
          </div>

          <div className="border-b border-black pb-3">
            <p className="mb-2 font-bold">RENDEZ-VOUS</p>
            <div className="flex justify-between mb-1">
              <span>DATE RDV</span>
              <span>
                {bookingData.date &&
                  formatMoroccoDate(bookingData.date, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
              </span>
            </div>
          </div>

          {isGroup ? (
            receiptSummary!.participants.map((participant, pIdx) => (
              <div key={pIdx} className="border-b border-black pb-3">
                <div className="flex justify-between mb-1">
                  <p className="font-bold">{participant.name.toUpperCase()}</p>
                  {participant.time && <span>{participant.time}</span>}
                </div>
                {renderServices(participant.services)}
                <div className="flex justify-between mt-2 pt-2 border-t border-dashed border-black">
                  <span>SOUS-TOTAL</span>
                  <span>{participant.subtotal}.00</span>
                </div>
              </div>
            ))
          ) : (
            <div className="border-b border-black pb-3">
              <div className="flex justify-between mb-1">
                <p className="font-bold">SERVICES</p>
                {bookingData.time && <span>{bookingData.time}</span>}
              </div>
              {renderServices(selectedServices)}
              <div className="flex justify-between mt-3 pt-2 border-t border-dashed border-black">
                <span>DUREE TOTALE</span>
                <span>{bookingData.totalDuration}</span>
              </div>
            </div>
          )}

          <div className="border-b-2 border-black pb-3">
            <div className="flex justify-between text-base font-bold">
              <span>TOTAL</span>
              <span>{grandTotal}.00 MAD</span>
            </div>
          </div>

          <div className="text-center text-[10px] text-black pt-2">
            {displayIce && <p className="mb-1">ICE: {displayIce}</p>}
            {(displayRc || displayIf) && (
              <p className="mb-3">
                {displayRc && `RC: ${displayRc}`}
                {displayRc && displayIf && ' - '}
                {displayIf && `IF: ${displayIf}`}
              </p>
            )}
            <p className="mb-1">MERCI DE VOTRE VISITE</p>
            <p>A BIENTOT</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Receipt;
