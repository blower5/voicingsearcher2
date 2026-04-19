//IN THIS DOCUMENT:
//a bunch of lazily copied graph code
//(because I shouldn't be touching this stuff again)


//given a frequency, find the UV coord (normalized x coord from 0 to 1)
function freq_to_uv(freq_in) {
	return (freq_in - left_freq) / (right_freq-left_freq);
}

			
function lin_uv_to_log(uv) {
	let c = 1/(log_base - 1);
	return c*(log_base**uv)-c;
}

function log_uv_to_lin(uv) {
	let c = 1/(log_base - 1);
	return Math.log2( (uv+c)/c ) / Math.log2(log_base);
}


function draw_title(title, x) {
	//BACKGROUND FOR TITLE
	ctx.fillStyle = '#333';
	ctx.fillRect(0, 0, width, 220);
	
	//TITLE
	ctx.fillStyle = '#eee';
	ctx.font = "48px sans-serif";
	ctx.fillText( title, x, 200 )
}


//input is a 2d array [[color, name], [color, name], [color, name]...]
function draw_key(arr,x,y, width) {
	for (i in arr) {
		ctx.fillStyle = "#333"; //background
		ctx.fillRect(x-4,y-5 + 33*i,width+4,40);
		
		//block of color
		ctx.fillStyle = arr[i][0];
		ctx.fillRect(x,y + 33*i,60,30);
		ctx.strokeStyle = "#282828";
		ctx.lineWidth = 3;
		ctx.strokeRect(x,y + 33*i,60,30);
		
		//text
		ctx.fillStyle = "#eee";
		ctx.font = "20px sans-serif";
		ctx.fillText( arr[i][1], x + 67,y + 33*i + 22);
	}
}



function draw_labels_linear() {
	ctx.fillStyle = '#eee';
	ctx.font = "18px sans-serif";
	
	
	ctx.lineWidth = 2;
	ctx.strokeStyle = "#666";
	
	for (let i = 175; i < right_freq; i += 25) {
		ctx.beginPath();
		ctx.moveTo( freq_to_uv(i) * width, height - 65);
		ctx.lineTo( freq_to_uv(i) * width, 20);
		ctx.stroke();
	}
	
	for (let i = 100; i < right_freq; i += 50) {
		ctx.fillStyle = '#aaa';
		ctx.fillText( i, freq_to_uv(i) * width - 16, height - 45);
	}
	
	ctx.strokeStyle = "#999";
	
	for (let i = 100; i < right_freq; i += 100) {
		ctx.fillStyle = '#eee';
		ctx.fillText( i, freq_to_uv(i) * width - 16, height - 45);
		ctx.beginPath();
		ctx.moveTo( freq_to_uv(i) * width, height - 65);
		ctx.lineTo( freq_to_uv(i) * width, 20);
		ctx.stroke();
	}
}


function draw_labels_log() {
	ctx.fillStyle = '#eee';
	ctx.font = "18px sans-serif";
			
	ctx.lineWidth = 2;
	ctx.strokeStyle = "#666";
	
	for (let i = 175; i < right_freq; i += 25) {
		ctx.beginPath();
		ctx.moveTo( log_uv_to_lin(freq_to_uv(i)) * width, height - 65);
		ctx.lineTo( log_uv_to_lin(freq_to_uv(i)) * width, 20);
		ctx.stroke();
	}
	
	for (let i = 100; i < right_freq; i += 50) {
		ctx.fillStyle = '#aaa';
		ctx.fillText( i, log_uv_to_lin(freq_to_uv(i)) * width - 16, height - 45);
	}
	
	ctx.strokeStyle = "#999";
	
	for (let i = 100; i < right_freq; i += 100) {
		ctx.fillStyle = '#eee';
		ctx.fillText( i, log_uv_to_lin(freq_to_uv(i)) * width - 16, height - 45);
		ctx.beginPath();
		ctx.moveTo( log_uv_to_lin(freq_to_uv(i)) * width, height - 65);
		ctx.lineTo( log_uv_to_lin(freq_to_uv(i)) * width, 20);
		ctx.stroke();
	}
}