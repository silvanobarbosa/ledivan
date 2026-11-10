// `server-only` existe para QUEBRAR o build quando um módulo de servidor vaza para o cliente.
// No teste não há cliente: o vitest aponta para este vazio e o módulo roda como qualquer outro.
export {};
