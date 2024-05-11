var dates = []
var totaldata = []

function chart(updatecookies) {
    const ctx = document.getElementById('myChart');
    var higherweight = 0;
    var smallerweight = 999;
    let cvalue = '';
    let labels = ['', '', '', '', '', '']
    let extra = 0;
    if (userweight.length <= 2){
        totaldata.push(userweight[0].weight)
        dates.push('Starting Week!')
        extra = 1
    }
    for (let i = 0; i < userweight.length; i++){
        totaldata.push(userweight[i].weight)
        dates.push(userweight[i].date)
        if(userweight[i].weight > higherweight){higherweight = userweight[i].weight}
        if(userweight[i].weight < smallerweight){smallerweight = userweight[i].weight}
        cvalue += userweight[i].weight+"!"+userweight[i].date
        if(i < userweight.length-1){cvalue += ','}
    }
    if (updatecookies){
    Cookie("UserWeight", cvalue)}
    for (let j = 6; j < userweight.length; j++){
        labels.push('')
    }
    if(userweight.length >= 7){
        let ratio = (userweight[userweight.length-1].weight/userweight[userweight.length-1-6].weight)-1
        ratio *= 100
        ratio = ratio.toFixed(2)
        let symbol = '+'
        if(ratio < 0){symbol = '-'}
        document.getElementById('gomo_weight').innerHTML = symbol+" "+Math.abs(ratio)+" %"
    }
    let weighttext = parseFloat(totaldata[totaldata.length-1])
    if (weighttext % 1 === 0) {
        weighttext += '.00';
    }
    else if (weighttext*10 % 1 === 0){
        weighttext += '0';
    }
    document.getElementById('currentweight').innerText = weighttext
    let sugmin = parseInt(smallerweight)-1-extra
    let sugmax = parseInt(higherweight)+1+extra
    const bgcolor = [];
    for (let j = 0; j < totaldata.length; j++){
        if (parseFloat(totaldata[j]) < parseFloat(totaldata[j-1])){bgcolor.push('#c26655')}
        else{bgcolor.push('#5db677')}
    }
    if (totaldata[totaldata.length-1] < totaldata[totaldata.length-2]){bgcolor.push('#c26655')}
    else{bgcolor.push('#5db677')}
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: ' ',
                data: totaldata,
                segment: {
                    borderColor: (ctx) => {
                        const yVal = ctx.p1.parsed.y;
                        for (let k = 0; k < labels.length; k++){
                            if(parseFloat(yVal) === parseFloat(totaldata[k])){
                                if (yVal < totaldata[k-1]) {

                                    return '#DB6F5B'}
                                else{return '#60be7c'}
                            }
                        }
                    },
                },
                borderColor: 'white',
                borderWidth: 3,
                pointStyle: 'round',
                hitRadius: 300,
                radius: 0,
                fill: false,
                tension: 0.3,
                bodyFont: 'Poppins',
                pointRadius: 0,
                pointHoverRadius: 6,
                backgroundColor: bgcolor,
                hoverBorderWidth: 2
            }]
        },
        options: {
            layout: {
                padding: {
                    left: 2,
                    right: 0,
                    top: 0,
                    bottom: 0
                },
                margin: 100
            },
            scales: {
                y: {
                    beginAtZero: false,
                    display: false,
                    suggestedMin: sugmin,
                    suggestedMax: sugmax
                },
                x: {
                    display: false
                }
            },
            plugins: {
                tooltip: {
                    displayColors: false,
                    backgroundColor: 'transparent',
                    bodyFont: {
                        size: 15
                    },
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';

                            if (label) {
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y
                                if (context.parsed.y % 1 === 0) {
                                    label += '.00';
                                }
                                else if (context.parsed.y*10 % 1 === 0){
                                    label += '0';
                                }
                                label += " Kg";
                                let date = '';
                                date = dates[context.parsed.x]
                                label += ', ' + date;
                            }
                            return label;
                        },
                        labelTextColor: function (context) {
                            return '#323b48';
                        },
                        title: function (context) {
                            return ''
                        }
                    }
                },
                legend: {
                    display: false
                }
            }
        },
        plugins: [{
            afterDraw: chart => {
                if (chart.tooltip?._active?.length) {
                    let x = chart.tooltip._active[0].element.x;
                    let yAxis = chart.scales.y;
                    let ctx = chart.ctx;
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(x, yAxis.top);
                    ctx.lineTo(x, yAxis.bottom);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = 'rgba(112,116,122,0.5)';
                    ctx.stroke();
                    ctx.restore();
                }
            },
        }],
    });
}
