function futureValue(contribution, rate, years) {
  if (rate === 0) return contribution * years;
  return contribution * (Math.pow(1 + rate, years) - 1) / rate;
}

const IRPF_BRACKETS = [
  { limit: 12450, rate: 0.19 },
  { limit: 20200, rate: 0.24 },
  { limit: 35200, rate: 0.30 },
  { limit: 60000, rate: 0.37 },
  { limit: 300000, rate: 0.45 },
  { limit: Infinity, rate: 0.47 }
];

const CGT_BRACKETS = [
  { limit: 6000, rate: 0.19 },
  { limit: 50000, rate: 0.21 },
  { limit: 200000, rate: 0.23 },
  { limit: 300000, rate: 0.27 },
  { limit: Infinity, rate: 0.28 }
];

function taxTotal(income, brackets) {
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    const taxable = Math.min(income, b.limit) - prev;
    if (taxable > 0) tax += taxable * b.rate;
    if (income <= b.limit) break;
    prev = b.limit;
  }
  return tax;
}

function marginalRate(income) {
  for (const b of IRPF_BRACKETS) {
    if (income <= b.limit) return b.rate;
  }
  return IRPF_BRACKETS[IRPF_BRACKETS.length - 1].rate;
}

function capitalGainsTax(gain) {
  return taxTotal(gain, CGT_BRACKETS);
}

function planNet(planFV, pension, w) {
  if (w === planFV) {
    const tax = taxTotal(pension + planFV, IRPF_BRACKETS) - taxTotal(pension, IRPF_BRACKETS);
    return { net: planFV - tax };
  } else {
    const years = Math.floor(planFV / w);
    const remainder = planFV - years * w;
    const taxPerYear = taxTotal(pension + w, IRPF_BRACKETS) - taxTotal(pension, IRPF_BRACKETS);
    let totalTax = years * taxPerYear;
    if (remainder > 0) {
      totalTax += taxTotal(pension + remainder, IRPF_BRACKETS) - taxTotal(pension, IRPF_BRACKETS);
    }
    const net = planFV - totalTax;
    const months = remainder > 0 ? Math.round((remainder / w) * 12) : 0;
    return { net, years, months };
  }
}

function fundNet(fundFV, totalContrib) {
  const gain = fundFV - totalContrib;
  const tax = capitalGainsTax(gain);
  return fundFV - tax;
}

function calcular() {
  const salary = parseFloat(document.getElementById('salary').value || 0);
  const years = parseInt(document.getElementById('years').value || 0, 10);
  let contribution = parseFloat(document.getElementById('contribution').value || 0);
  if (contribution > 10000) contribution = 10000;
  const tir = parseFloat(document.getElementById('tir').value) / 100;
  const pension = parseFloat(document.getElementById('pension').value || 0);
  const reinvest = document.getElementById('reinvest').value === 'si';

  const planFV = futureValue(contribution, tir, years);
  const fundFV = futureValue(contribution, tir, years);
  const totalContrib = contribution * years;
  const fundNetTotal = fundNet(fundFV, totalContrib);

  const salaryRate = marginalRate(salary);
  const taxSavedYear = contribution * salaryRate;
  const totalTaxSaved = taxSavedYear * years;
  let savingsNet = totalTaxSaved;
  if (reinvest) {
    const savingsFV = futureValue(taxSavedYear, tir, years);
    const savingsNetTotal = fundNet(savingsFV, taxSavedYear * years);
    savingsNet = savingsNetTotal;
  }

  const lumpPlan = planNet(planFV, pension, planFV).net;
  const w10 = planNet(planFV, pension, 10000);
  const w15 = planNet(planFV, pension, 15000);
  const w20 = planNet(planFV, pension, 20000);
  const w25 = planNet(planFV, pension, 25000);
  const w35 = planNet(planFV, pension, 35000);

  const planNetTotal = lumpPlan + (reinvest ? savingsNet : totalTaxSaved);

  function row(title, obj) {
    return `<tr><td>${title}</td><td>${obj.net.toFixed(2)}</td><td>${obj.years ? obj.years : '-'} años ${obj.months ? obj.months : ''} meses</td></tr>`;
  }

  let html = `<h2>Resultados</h2>`;
  html += `<p>Neto total Plan de Pensiones: ${planNetTotal.toFixed(2)}€</p>`;
  html += `<p>Neto total Fondo de Inversión: ${fundNetTotal.toFixed(2)}€</p>`;
  if (!reinvest) {
    html += `<p>Ahorro fiscal no reinvertido: ${totalTaxSaved.toFixed(2)}€</p>`;
  } else {
    html += `<p>Ahorro fiscal reinvertido neto: ${savingsNet.toFixed(2)}€</p>`;
  }
  html += `<table><tr><th>Escenario</th><th>Neto Plan</th><th>Duración</th></tr>`;
  html += row('Rescate total', { net: lumpPlan, years: '-', months: '-' });
  html += row('Retirar 10000€/año', w10);
  html += row('Retirar 15000€/año', w15);
  html += row('Retirar 20000€/año', w20);
  html += row('Retirar 25000€/año', w25);
  html += row('Retirar 35000€/año', w35);
  html += `</table>`;
  html += `<table><tr><th>Escenario</th><th>Neto Fondo</th><th>Duración</th></tr>`;
  function fundRow(title, w) {
    const yearsFund = Math.floor(fundNetTotal / w);
    const rem = fundNetTotal - yearsFund * w;
    const months = rem > 0 ? Math.round((rem / w) * 12) : 0;
    return `<tr><td>${title}</td><td>${fundNetTotal.toFixed(2)}</td><td>${yearsFund} años ${months} meses</td></tr>`;
  }
  html += fundRow('Rescate total', fundNetTotal);
  html += fundRow('Retirar 10000€/año', 10000);
  html += fundRow('Retirar 15000€/año', 15000);
  html += fundRow('Retirar 20000€/año', 20000);
  html += fundRow('Retirar 25000€/año', 25000);
  html += fundRow('Retirar 35000€/año', 35000);
  html += `</table>`;

  document.getElementById('resultados').innerHTML = html;
}

