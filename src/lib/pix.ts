// Gerador de Pix copia-e-cola estático (BR Code / EMV). Sem API externa.
// Referência: Manual de Padrões para Iniciação do Pix (Bacen).

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

// CRC16-CCITT (polinômio 0x1021, init 0xFFFF) — exigido no campo 63.
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Remove acentos/limita — nome (25) e cidade (15) só ASCII.
function sanitize(s: string, max: number): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, max).toUpperCase();
}

export type PixParams = {
  key: string;       // chave Pix (email, telefone, cpf/cnpj, aleatória)
  name: string;      // nome do recebedor
  city: string;      // cidade do recebedor
  amount?: number;   // valor em reais (opcional; se ausente, o pagador digita)
  txid?: string;     // identificador (max 25, alfanumérico); default "***"
};

// Monta o payload copia-e-cola. Determinístico (sem data/random) — seguro pro cache do template.
export function buildPixCode({ key, name, city, amount, txid }: PixParams): string {
  const merchant = tlv("00", "BR.GOV.BCB.PIX") + tlv("01", key.trim());
  const amountStr = amount != null && amount > 0 ? amount.toFixed(2) : "";
  const tx = (txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  let payload =
    tlv("00", "01") +                    // Payload Format Indicator
    tlv("26", merchant) +                // Merchant Account Information - Pix
    tlv("52", "0000") +                  // Merchant Category Code
    tlv("53", "986") +                   // Moeda: BRL
    (amountStr ? tlv("54", amountStr) : "") +
    tlv("58", "BR") +                    // País
    tlv("59", sanitize(name, 25) || "RECEBEDOR") +
    tlv("60", sanitize(city, 15) || "BRASIL") +
    tlv("62", tlv("05", tx));            // Additional Data - txid

  payload += "6304";                     // campo CRC (id+len), valor calculado sobre tudo acima
  return payload + crc16(payload);
}
