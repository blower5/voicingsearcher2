//included files at this point:
//		Tone.js
//		vs2_math.js
//		table.js

const NOTE_OFFSET = 60; //don't play voicings at C-2, play them at C3

const PAGINATION_SIZE = 100 //how many voicings in one page

var VOICING_TABLE = []; //master array with all info, loaded from ./table.js
var RESULTS_TABLE = []; //results array, paginated, with relevant subset of full voicing table
var PAGE = 0;

//glossary:
//	edo			 - equal divisions of the octave. western music is 12 edo
//	note         - notes in 12 EDO
//  midi		 - absolute notes, 60 = C3
//  scale degree - note number in the voicing's edo, where 0 is fixed at the current NOTE_OFFSET
//  voicing      - array of scale degrees
//  id           - string in the form of "x.y" where x is the edo and y is a binary number where 1s denote a scale degree's inclusion in the voicing
//  freqs		 - array of frequencies in hz


//-------- tone js stuff -----------------------------------------------------------------------------------------------------
const fmsynth = new Tone.PolySynth(Tone.FMSynth,{
	oscillator: {
		type: "sine",
	},
	modulation: {
		type: "sine",
	},
	harmonicity: 3, //(this basically just means modulator coarse tuning)
	modulationIndex: 10, //modulator level
	modulationEnvelope: {
		attack: 0.01,
		decay: 0.8,
		sustain: 0.1,
		release: 0.8,
	},
	envelope: {
		attack: 0.01,
		decay: 6.0,
		sustain: 0.0,
		release: 0.1,
	},
}).toDestination();
fmsynth.maxPolyphony = 120;

const fmsynth2 = new Tone.PolySynth(Tone.FMSynth,{
	oscillator: {
		type: "sine",
	},
	modulation: {
		type: "sine",
	},
	harmonicity: 4, 
	modulationIndex: 10, //modulator level
	modulationEnvelope: {
		attack: 0.1,
		decay: 0.8,
		sustain: 0.1,
		release: 0.8,
	},
	envelope: {
		attack: 0.2,
		decay: 6.0,
		sustain: 0.0,
		release: 0.1,
	},
}).toDestination();
fmsynth2.maxPolyphony = 120;

const fmsynthbell = new Tone.PolySynth(Tone.FMSynth,{
	oscillator: {
		type: "sine",
	},
	modulation: {
		type: "sine",
	},
	harmonicity: 3.375,//3.375
	modulationIndex: 10,
	modulationEnvelope: {
		attack: 0.01,
		decay: 12.0,
		sustain: 0.1,
		release: 12.0,
	},
	envelope: {
		attack: 0.01,
		decay: 6.0,
		sustain: 0.0,
		release: 0.1,
	},
}).toDestination();
fmsynthbell.maxPolyphony = 120;


function play_voicing(voicing_id,tone=0) {
	let voicing_freq = id_to_freqs(voicing_id);
	switch (tone) {
		case 0:
		default:
			synth = fmsynth;
			break;
		case 1:
			synth = fmsynth2;
			break;
		case 2:
			synth = fmsynthbell;
			break;
	}
	synth.triggerAttackRelease(voicing_freq, "2n", Tone.now(), .9+Math.random()*.1);
}
//----------------------------------------------------------------------------------------------------------------------------

window.addEventListener('DOMContentLoaded', (event) => {
	
	clickprompt = document.getElementById("clickprompt");
	clickprompt.addEventListener("click", async () => {
		await Tone.start();
		console.log("tone.js ready");
		clickprompt.remove();
	})
	
	hide_tooltip();
	
	document.getElementById("addfilter").addEventListener("click", add_filter);
	document.getElementById("removefilter").addEventListener("click", remove_filter);

	//---------- DOM stuff ---------------------------------------------------------------------------------------------------
	search_params = new URLSearchParams(window.location.search);
	PAGE = parseInt(search_params.get('page')) - 1;
	sortby = search_params.get('sort');
	sortdesc = parseInt(search_params.get('desc'));
	
	//defaults
	if (!PAGE) PAGE = 0;
	if (!sortby) sortby = "d2";
	if (!sortdesc) sortdesc = 0;
	
	document.getElementById('sort').value = sortby;
	document.getElementById('desc').value = sortdesc;
	
	//filter handling has hopefully been abstracted in a way
	//that it will be easier to implement having an arbitrary
	//amount later. right now it is hard coded to four 
	//filters in the html.
	let all_filter_divs = Array.from(document.getElementsByClassName("filterdiv"));
	let filter_params = [];
	for (let i in all_filter_divs) {
		
		//why is i a string??? i should not be a string.
		i = parseInt(i);
		
		//get filter parameters from url
		//these start at f1type, f11, f12, f2type...
		filtertype       =  search_params.get('f'+ (i+1) +'type');
		filtercomparison =  search_params.get('f'+ (i+1) +'1');
		filtertext       =  search_params.get('f'+ (i+1) +'2');
		
		//console.log( "filter " + (i+1) + " settings: " + filtertype + " " + filtercomparison + " " + filtertext );
		
		//defaults
		if (!filtertype) filtertype = '-';
		if (!filtercomparison) filtercomparison = '-';
		if (!filtertext) filtertext = '';
		
		//add filter params to a 2d list to be used later
		filter_params.push( [filtertype, filtercomparison, filtertext] );
		
		//first, update filter type dropdown.
		all_filter_divs[i].children[1].value = filtertype;
		
		//after filter type is updated, update the comparsion dropdown, and add a handler to 
		//do it automatically later, when the filter type changes.
		filter_dropdown_update( all_filter_divs[i] );
		all_filter_divs[i].children[1].addEventListener('change', filter_dropdown_callback);
		
		//now that the comparison dropdown has the correct options, update all the filter fields.
		all_filter_divs[i].children[2].value = filtercomparison;
		all_filter_divs[i].children[3].value = filtertext;
	}
	//------------------------------------------------------------------------------------------------------------------------
	
	hide_empty_filters();
	
	search_voicing_table(sortby,sortdesc,filter_params);
	
	create_paged_results(PAGE);
	
});


//the filters need different options in the dropdowns depending
//on what kind of filter it is. these functions replace the options
//when the filtertype changes. the first is a callback

function filter_dropdown_callback(event) {
	let filter_div = this.parentElement;
	filter_dropdown_update(filter_div);
}

function filter_dropdown_update(filter_div) {
	let filtertype_dropdown = filter_div.children[1];
	let filter_comparison_dropdown = filter_div.children[2];
	let filter_text_field = filter_div.children[3];

	let comparison_options = [];

	switch (filtertype_dropdown.value) {
		case "-":
		default:
			comparison_options = [ ["-","-"] ];
			//clear text field
			filter_text_field.value = '';
			filter_text_field.placeholder = '---';
			break;
		
		case "edo":
		case "d":
		case "d3":
		case "db":
		case "notes":
			//numbers handler
			comparison_options = [ ["less than","n-lt"], ["less than or equal","n-lte"], ["equals","n-eq"], ["more than","n-mt"], ["more than or equal","n-mte"] ];
			filter_text_field.placeholder = "a number";
			break;
			
		case "ci":
		case "mi":
		case "w":
		case "fi":
			//solfege handler
			comparison_options = [ ["less than","s-lt"], ["equals","s-eq"], ["more than","s-mt"], ["contains the text","s-c"] ];
			filter_text_field.placeholder = "solfege";
			break;
			
		case "12edo":
		case "a":
			//text handler (for 12edo equivalent chord and attributes)
			comparison_options = [ ["contains the text","t-c"], ["is exactly","t-ie"] ];
			filter_text_field.placeholder = "text";
			break;
	}
	
	while (filter_comparison_dropdown.options.length > 0) {
		filter_comparison_dropdown.options.remove(0);
	}
	
	for (let i of comparison_options) {
		filter_comparison_dropdown.options.add( new Option(i[0], i[1]) );
	}
}






//the filtertypes names dont necessarily match the names of the voicing objects' keys
//this is the lookup table / dictionary to convert filter type to voicing key name
const FILTERTYPE_LOOKUP = {
	'edo':'edo',
	'd':'d',
	'd3':'d3',
	'db':'db',
	'notes':'notes',
	'ci':'ci',
	'mi':'mi',
	'w':'w_notes',
	'fi':'fi_notes',
	'a':'a',
	'12edo':'r12s_name'
};

function search_voicing_table(sortby,descending,filter_params) {
	
	//create filtered subset of table then sort
	console.log("filtering...");
	
	var voicing_table_filtered = VOICING_TABLE;
	
	//filter, for every filter available
	for (let i of filter_params) {
		let filtertype_dropdown = i[0];
		let filter_comparison_dropdown = i[1];
		let filter_text_field = i[2];
	
		if (filtertype_dropdown != '-') {
			key_to_compare = FILTERTYPE_LOOKUP[filtertype_dropdown];
			convert_to_number = false;
			
			//functions return truthy to keep that voicing in the set.
			//A is the value of the voicings key_to_compare
			//B is what has been typed in the filter textfield
			switch (filter_comparison_dropdown) {
				//number operations
				case 'n-lt':
					filterfunc = (a,b)=>{return a < b};
					convert_to_number = true;
					break;
				case 'n-lte':
					filterfunc = (a,b)=>{return a <= b};
					convert_to_number = true;
					break;
				case 'n-eq':
					filterfunc = (a,b)=>{return a == b};
					convert_to_number = true;
					break;
				case 'n-mt':
					filterfunc = (a,b)=>{return a > b};
					convert_to_number = true;
					break;
				case 'n-mte':
					filterfunc = (a,b)=>{return a >= b};
					convert_to_number = true;
					break;
				//solfege operations
				case 's-lt':
					filterfunc = (a,b)=>{return a < name_to_note(b,true) };
					break;
				case 's-eq':
					//converting to note and back fixes an edge case
					//where you filter for solfege equal to e.g. "da" (with no octave number)
					//and the filter is supposed to fill in the octave for you
					filterfunc = (a,b)=>{return note_to_name(a+24) == note_to_name(name_to_note(b)) };
					break;
				case 's-mt':
					filterfunc = (a,b)=>{return a > name_to_note(b,true) };
					break;
				case 's-c':
					//search returns -1 when no match is found, so add one
					//to make it falsy
					filterfunc = (a,b)=>{return note_to_name(a+24).search(b)+1};
					break;
					
				//to save space, keys with empty values aren't added to the database
				//this means we need to handle undefined values for r12s and attributes
			
				case 't-c': //text operation
					filterfunc = (a,b)=>{
						if (a == undefined) return 0;
						return a.search(b)+1;
					};
					break;
				case 't-ie': //text operation
					filterfunc = (a,b)=>{
						if (a == undefined) return 0;
						return a == b;
					};
					break;
			}

			if (convert_to_number) filter_text_field = parseFloat(filter_text_field);
			
			//copy table and filter it
			var voicing_table_filtered = voicing_table_filtered.filter( voicing=>(   filterfunc( voicing[key_to_compare], filter_text_field)   ) );
		}
	}
	
	console.log("filtering done. sorting...");


	switch (sortby) {
		case "id":
			sortfunc = (a,b)=>{
				ap = id_split(a.id);
				bp = id_split(b.id);
				if (ap[0] != bp[0]) return ap[0] - bp[0];
				return ap[1] - bp[1];
			};
			break;
			
		case "d":
		default:
			sortfunc = (a,b)=>{return a.d - b.d};
			break;
			
		case "d3":
			sortfunc = (a,b)=>{return a.d3 - b.d3};
			break;
			
		case "db":
			sortfunc = (a,b)=>{return a.db - b.db};
			break;
			
		case "ci":
			sortfunc = (a,b)=>{return a.ci - b.ci};
			break;
		
		case "w":
			sortfunc = (a,b)=>{return a.w_notes - b.w_notes};
			break;
			
		case "12edo":
			sortfunc = (a,b)=>{return a.r12s_conf - b.r12s_conf};
			break;
			
		case "random":
			sortfunc = (a,b)=>{return Math.random() - .5};
			break;
	}
	
	//reverse the output of sortfunc if sorting descending
	voicing_table_filtered.sort( (a,b)=>{return (1-descending*2) * sortfunc(a,b)} );
	
	RESULTS_TABLE = [];
	
	//paginate
	for (let i in voicing_table_filtered) {
		page_index = Math.floor(i/PAGINATION_SIZE);
		RESULTS_TABLE[page_index] ??= [] //make page if it doesnt exist
		RESULTS_TABLE[page_index].push(voicing_table_filtered[i]);
	}
}

//create_paged_results uses 0 index, the page selector uses 1 as index
function create_paged_results(page) {

	results_element = document.getElementById('results');

	//clear results element
	//hmm maybe don't use innerhtml BUT its really fast!
	results_element.innerHTML = "";
	
	results_element.appendChild(create_page_selector(page));
	//------------------------- APPEND TABLE ------------------------------
	
	table = document.createElement('table');
	
	//TODO is there a better way of making a lot of td ?
	//TODO maybe turn on / off columns?
	
	
	//list of header cells and their title text (hover text)
	let trhead = document.createElement('tr');
	let thlist = [
		["ID"			,"voicing ID"],
		["notes"		,"notes of this voicing"],
		["solfege"		,"readable names of the notes"],
		["2-diss."		,"2-dissonance"],
		[""				,""],
		["3-diss."		,"3-dissonance"],
		[""				,""],
		["bell diss."	,"bell dissonance"],
		[""				,""],
		["CI"			,"characteristic interval"],
		["MI"			,"median interval"],
		["width"		,"how big is this voicing"],
		["att."			,"attributes of this chord. hover over to see full names"],
		["12edo equiv."	,"best guess as to what chord this sounds like in 12 edo"],
		["confidence"	,"how close is this voicing to the named chord"]]
	
	for (let i of thlist) {
		let th = document.createElement('th');
		th.textContent = i[0]
		th.title = i[1]
		trhead.appendChild(th);
	}
	table.appendChild(trhead);
	
	
	for (let i in RESULTS_TABLE[page]) {
		
		let tr = document.createElement('tr');
		
		let tdid 				= document.createElement('td');
		let tdv 				= document.createElement('td');
		let tdvreadable			= document.createElement('td');
		let tdvdissonance 		= document.createElement('td');
		let tdbutton 			= document.createElement('td');
		let tdvdissonance3 		= document.createElement('td');
		let tdbutton3 			= document.createElement('td');
		let tdvdissonancebell   = document.createElement('td');
		let tdbuttonbell 		= document.createElement('td');
		let tdcharinter 		= document.createElement('td');
		let tdmedianinter 		= document.createElement('td');
		let tdwidth				= document.createElement('td');
		let tdatt 				= document.createElement('td');
		let td12edoeq 			= document.createElement('td');
		let td12edoerror 		= document.createElement('td');
		
		let hearbutton = document.createElement('button');
		hearbutton.voicing_id = RESULTS_TABLE[page][i].id;
		hearbutton.onclick = function() {play_voicing(event.target.voicing_id,0)};
		hearbutton.textContent = "hear";
		
		let hearbutton3 = document.createElement('button');
		hearbutton3.voicing_id = RESULTS_TABLE[page][i].id;
		hearbutton3.onclick = function() {play_voicing(event.target.voicing_id,1)};
		hearbutton3.textContent = "hear";
		
		let hearbuttonbell = document.createElement('button');
		hearbuttonbell.voicing_id = RESULTS_TABLE[page][i].id;
		hearbuttonbell.onclick = function() {play_voicing(event.target.voicing_id,2)};
		hearbuttonbell.textContent = "hear";
		
		tdid.textContent = RESULTS_TABLE[page][i].id;
		tdv.textContent = RESULTS_TABLE[page][i].edo + ": " + id_to_voicing(RESULTS_TABLE[page][i].id)[1];
		tdvreadable.textContent = RESULTS_TABLE[page][i].voicing_r;
		
		tdvdissonance.textContent = RESULTS_TABLE[page][i].d.toFixed(3);
		tdbutton.appendChild(hearbutton);
		
		tdvdissonance3.textContent = RESULTS_TABLE[page][i].d3.toFixed(3);
		tdbutton3.appendChild(hearbutton3);
		
		tdvdissonancebell.textContent = RESULTS_TABLE[page][i].db.toFixed(3);
		tdbuttonbell.appendChild(hearbuttonbell);
		
		tdcharinter.textContent = RESULTS_TABLE[page][i].ci_r;
		tdmedianinter.textContent = RESULTS_TABLE[page][i].mi_r;
		tdwidth.textContent = RESULTS_TABLE[page][i].w_notes_r;
		tdatt.textContent = RESULTS_TABLE[page][i].a;
		
		td12edoeq.textContent = RESULTS_TABLE[page][i].r12s_name;
		if (td12edoeq.textContent != "") td12edoerror.textContent = RESULTS_TABLE[page][i].r12s_conf.toFixed(2);
		
		tr.id = RESULTS_TABLE[page][i].id;
		
		//tr color coding by dissonances! a dissonance over 2 is clamped
		//outputs 128-255
		
		tr_red = 255 - (Math.min(RESULTS_TABLE[page][i].d, 2) * 64 );
		tr_green = 255 - (Math.min(RESULTS_TABLE[page][i].d3, 2) * 64 );
		tr_blue = 255 - (Math.min(RESULTS_TABLE[page][i].db, 2) * 64 );
		 
		tr.style = "color: rgb(" + tr_red + ", " + tr_green + ", " + tr_blue + ");";
		
		tr.addEventListener('mouseover', e => {
			show_tooltip(tr.id);
		});
		tr.addEventListener('mouseout', e => {
			hide_tooltip();
		});
		
		[
			tdid,
			tdv,
			tdvreadable,
			tdvdissonance,
			tdbutton,
			tdvdissonance3,
			tdbutton3,
			tdvdissonancebell,
			tdbuttonbell,
			tdcharinter,
			tdmedianinter,
			tdwidth,
			tdatt,
			td12edoeq,
			td12edoerror
		].forEach( td => tr.appendChild(td) );
		
		table.appendChild(tr);
	}
	results_element.appendChild(table);

	//---------------------------------------------------------------------
	results_element.appendChild(create_page_selector(page));
}

//generate page selection html
function create_page_selector(current_page){
	//page 1 (index 0) and last page are always shown
	//sorry in advance for the off by 1 errors here
	
	current_page = parseInt(current_page);
	
	page_start = Math.max(2,current_page - 2);
	page_end   = Math.min(RESULTS_TABLE.length, current_page + 5);
		
	page_selector = document.createElement('span');
	
	label = document.createElement('span')
	label.textContent = "page:"
	page_selector.appendChild(label);
	
	pages = [1];
	for (let i = page_start; i < page_end; i++) pages.push(i);
	pages.push(RESULTS_TABLE.length);
	
	//example page 1... 5,6,7,8,9,10,11... page 86
	
	for (let i of pages) {
		page_button = document.createElement('button');
		page_button.textContent = i;
		page_button.addEventListener("click", x => {
			//the variable 'i' would be out of scope when this function is called
			//the pages are indexed by 1 and not 0
			create_paged_results(event.target.textContent - 1); 
		});
		page_button.className = "pageSelectorPage";
		if (i - 1 == current_page) page_button.className = "pageSelectorPage pageSelectorCurrentPage";
		page_selector.appendChild(page_button);
	}
	
	return page_selector;
}





//hiding and unhiding the filters

//make sure dropdowns are set from the url params before calling this
//go backwards from the end and hide until the filter isn't empty
function hide_empty_filters() {
	let all_filter_divs = Array.from(document.getElementsByClassName("filterdiv"));
	for (let i = all_filter_divs.length - 1; i >= 1; i--) {
		if (all_filter_divs[i].children[1].value != "-") {
			break;
		}
		all_filter_divs[i].hidden = true;
	}
}

//go forwards until you hit an invisible filter, show
function add_filter(event) {
	let all_filter_divs = Array.from(document.getElementsByClassName("filterdiv"));
	let first_hidden_filter = -1;
	for (let i in all_filter_divs) {
		if (all_filter_divs[i].hidden) {
			first_hidden_filter = i;
			break;
		}
	}
	if (first_hidden_filter == -1) {
		return;
	}
	all_filter_divs[first_hidden_filter].hidden = false;
}

//go backwards until you hit a visible filter, hide
//also, clear the newly hidden filters data.
function remove_filter(event) {
	let all_filter_divs = Array.from(document.getElementsByClassName("filterdiv"));
	let last_visible_filter = 0;
	for (let i = all_filter_divs.length - 1; i >= 1; i--) {
		if (all_filter_divs[i].hidden == false) {
			last_visible_filter = i;
			break;
		}
	}
	//I use 0 instead of -1 here because it should never hide the first filter.
	if (last_visible_filter == 0) {
		return;
	}
	all_filter_divs[last_visible_filter].hidden = true;
	all_filter_divs[last_visible_filter].children[1].value = "-"; //set type dropdown to none
	filter_dropdown_update(all_filter_divs[last_visible_filter]); //update other values (clear them)
}






//handle mouse movement: add mouse position as css variables
document.addEventListener('mousemove', e => {
	
	document.documentElement.style.cssText = "--cursor-left: " + e.clientX + "px; --cursor-top: " + e.clientY + "px;" 
	
});

//lookup object for attribute letter to full name and color
//used in the tooltip
const ATTRIBUTE_LOOKUP = {
	"m":["mirror"  			,"#dd9"],
	"e":["equal"   			,"#494"],
	"p":["pyramid" 			,"#9cc"],
	"i":["inverted pyramid" ,"#c99"]
};

//canvas handling for tooltip / mouseover box
function show_tooltip(voicing_id) {
	let hoverbox = document.getElementById('hoverbox');
	let hoverboxcanvas = document.getElementById('hoverboxcanvas');
	
	let voicing = VOICING_TABLE.find(e => (e.id == voicing_id));	
	
	let diss = voicing.dissonance;
	
	let width = hoverbox.clientWidth;
	let height = hoverbox.clientHeight;
	
	hoverboxcanvas.width = width;
	hoverboxcanvas.height = height;
	
	hoverbox.style.visibility = 'visible';
	//hoverbox.style.display = 'initial';
	
	ctx = hoverboxcanvas.getContext('2d');
	
	ctx.clearRect(0, 0, width, height);
	
	//<-------------- width ------------->
	//<--- height --->
	//+--------------+-------------------+  ^
	//|              | (attributes)      |  |
	//|              |                   |  |
	//| (piano roll) |                   |  height
	//|              |                   |  |
	//|              |                   |  |
	//|              | (details)         |  |
	//+--------------+-------------------+  v

	//the voicing is drawn in a 1:1 box aligned left with dimensions height x height
	
	//draw the voicing as piano roll
	//vertical grid size is the smallest amount of octaves this voicing fits into, in notes
	let [voicing_edo,voicing_notes] = id_to_voicing(voicing.id);
	let least_octaves = voicing_edo * Math.ceil(voicing.w/voicing_edo);
	
	for (let i = 0; i <= least_octaves; i++) {
		ctx.fillStyle = '#444';
		//if drawing the box that corresponds to a note that is in the voicing, draw
		//it in red instead of grey
		if (voicing_notes.indexOf(i) != -1) ctx.fillStyle = '#f44';
		ctx.fillRect(0, height - height/(least_octaves+1)*(i+1), height, height/(least_octaves+1)*0.9  );
	}
	
	//draw lines where the fifth and octave are.
	//offset it by -0.5 to draw in the middle of the note.
	// 584/1000 = 702/1200 = 702 cents = a fifth
	//draw these for every octave that could be visible
	//label them on the right
	ctx.font = "14px sans-serif";

	//draw the lowest note, da1
	ctx.strokeStyle = '#eeea';
	ctx.fillStyle = '#eeea';
	octave_y = height - height/(least_octaves+1)*(0.5);
	ctx.strokeRect(0, octave_y, height, 1 );
	ctx.fillText("da", height + 3, octave_y + 2);
	
	for (let i = 0; i < Math.ceil(least_octaves/voicing_edo); i++) {
		ctx.strokeStyle = '#aaea';
		ctx.fillStyle = '#aaea';
		fifth_y = height - height/(least_octaves+1)*(0.584*voicing_edo+0.5 + voicing_edo*i);
		ctx.strokeRect(0, fifth_y, height, 1 ); 
		ctx.fillText("sa", height + 3, fifth_y + 5);
		
		ctx.strokeStyle = '#eeea';
		ctx.fillStyle = '#eeea';
		octave_y = height - height/(least_octaves+1)*(0.5 + voicing_edo*(i+1));
		ctx.strokeRect(0, octave_y, height, 1 );
		ctx.fillText("da", height + 3, octave_y + 5);
		
	}
	//draw box outline (draw it over the piano roll boxes)
	ctx.strokeStyle = '#666f';
	ctx.strokeRect(0,0,height + 24.5,height);
	ctx.strokeStyle = '#888f';
	ctx.strokeRect(0,0,width,height);
	
	//draw attribute text in the top right corner
	if (voicing.a) {
		ctx.fillStyle = '#eeea';
		ctx.fillText("attributes:", height + 30, 15);
		let attributes = voicing.a.split('');
		for (i in attributes) {
			ctx.fillStyle = ATTRIBUTE_LOOKUP[attributes[i]][1];
			ctx.fillText(ATTRIBUTE_LOOKUP[attributes[i]][0], height + 40, 30 + 15*i);
		}
	}
	
	//draw details text in bottom right corner
	ctx.fillStyle = '#aaaa';
	if (voicing.r12s_name) ctx.fillText(voicing.r12s_name, height + 30, height - 20);
	ctx.fillText(voicing.id, height + 30, height - 5);
	
	//debug text
	// ctx.font = "14px sans-serif";
	// ctx.fillStyle = 'white';
	// ctx.fillText(voicing.width, 10, 90);
	// ctx.fillText(voicing.firstinterval, 10, 70);
}

function hide_tooltip() {
	let hoverbox = document.getElementById('hoverbox');
	hoverbox.style.visibility = 'hidden';
	//hoverbox.style.display = 'none';
}