export const performanceHtml = (values = [["1 mes", "1,25"], ["3 meses", "-2.50"], ["6 meses", "3,5"], ["YTD", "4,5"]]) =>
  '<h2>Rentabilidades acumuladas %</h2><table><tr><th>Periodo</th><th>Categoría</th><th>Rentabilidad</th></tr>' +
  values.map(([period, value]) => `<tr><td>${period}</td><td>99,9</td><td>${value}</td></tr>`).join("") + '</table>';
export const ratiosHtml = '<h2>Análisis de Rentabilidad/Riesgo</h2><table><tr><th>Medida de riesgo</th><th>3 años</th><th>5 años</th></tr><tr><td>Ratio de Sharpe</td><td>0,8</td><td>1,1</td></tr><tr><td>Volatilidad</td><td>12,2</td><td>15,3</td></tr></table>';
export const feesHtml = '<table><tr><th>Comisiones anuales</th></tr><tr><td>Comisiones de gestión</td><td>1,2%</td></tr><tr><td>KID Gastos Corrientes</td><td>0,3%</td><td></td><td></td></tr></table>';
