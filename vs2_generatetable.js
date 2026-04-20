const fs = require('node:fs');
//const fs = require('fs');

//run locally with nodejs to generate table
//the other option is to generate a blob url in regular js
//but the giant table is probably too big for that!

const VOICING_MIN_NOTES = 2;
const VOICING_MAX_NOTES = 5;
const NOTE_OFFSET = 60; //don't play voicings at C-2, play them at C3
const VOICING_BASS_INTERVAL_WIDTH = 1;

var EDO = 12;
var EDOS_TO_GENERATE = [	5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31];
//var EDOS_TO_GENERATE = [7,12];

//maximum width of the voicings in *scale degrees*. 
//the voicings will consist of every possible subset of this amount of notes.
var VOICING_MAX_WIDTH = 24;
//for lower edos, the above will generate very wide voicings. everything above this
//threshold (in notes) will be cut.
var VOICING_CUTOFF_THRESHOLD_NOTES = 31; //31 is 2 octaves + a fifth


var VOICING_TABLE = []; //master array with all info















CHORD_NAMES = {
	'01': 'minor second / b9th',
	'02': 'major second / 9th',
	'03': 'minor third',
	'04': 'major third',
	'05': 'fourth / fifth',
	'06': 'tritone / #11th / b5th',
	
	//minor
	
	'037': 'min',
	'0237': 'min add 9',
	'02578': 'min 6/9',
	'0358': 'min 7',
	'0458': 'min maj 7',
	'0258': 'min 7 b5', //hdim 7. same pitch set as min 6
	'025': 'min 7', //min7 no 5th
	'03578': 'min 9',
	'0245': 'min 9', //no 5
	'024579': 'min 11',
	'02457': 'min 11', //no 5
	'02579': 'min 11', //no 3
	'02357': 'min 11 type 2', //no 7 -- these min 11s don't have a full major triad on the top - this makes them sound noticiably different. interesting!
	'0235': 'min 11 type 2', //no 5 no 7
	
	//major
	
	'047': 'maj',
	'0247': 'maj add 9',
	'02479': 'maj 6/9',
	'0347': 'maj add #9',
	'0467': 'maj add #11',
	'0378': 'maj 7',
	'015': 'maj 7', //no 5
	'01358': 'maj 9',
	'0135': 'maj 9', //no 5
	'01458': 'maj 7 #9',
	'0145': 'maj 7 #9', //no 5
	'02378': 'maj 7 #11',
	'0157': 'maj 7 #11', //no 5
	'013578': 'maj 9 #11',
	'01357': 'maj 9 #11', //no 5
	'02467': 'maj 9 #11', //no 7
	
	//dominants and altered dominants
	
	'0368': '7',
	'026': '7', //no 5
	'0268': '7 b5',
	'0468': '7 #5',
	'02469': '9',
	'03579': '9',
	'0246': '9', //no 5
	
	'03689': '7 b9',
	'0236': '7 b9', //no 5
	'01479': '7 #9',
	'0256': '7 #9', //no 5
	
	
	'02468': '9 #5 / 9 b5',
	'02368': '7 b5 b9',
	'02568': '7 b5 #9',
	'02458': '7 #5 b9',
	'02478': '7 #5 #9',
	
	'01568': '13', //no 5 or 9
	'0137': '13', //no 5 9, or 11
	
	//suspended chords
	
	'027': 'sus 2',
	'0267': 'sus 2 add #11',
	'0357': 'min 7 sus 2',
	'0457': 'maj 7 sus 2',
	'057': 'sus 4',
	'0257': 'sus 4 add 9',
	'01368': 'maj 9 sus 4',
	
	
	'036': 'dim',
	'0369': 'dim 7',
	'048': 'aug',
	'0248': 'aug 9' //you could put this in the alt chord pile if you wanted to
};












function note_to_name(midinote,showoctave=true) {
	//find the closest note, then find the error

	octave = ""
	if (showoctave)	octave = Math.floor(midinote/12 + 1/24) - 1; //0 is C -1 ! you need to add the quarter tone to correctly round up to C
	rounded = Math.round(midinote);
	error = midinote - rounded;
	notelist = ["d","ut","r","n","m","f","sh","s","fl","l","th","t"];
	accidentallist = ["u","o","a","e","i"];
	return notelist[rounded%12] + accidentallist[Math.round(error*4)+2] + octave;
}

//only use when completely necessary
//used when user input in solfege needs to be converted back to notes for doing math
//this currently breaks when NOTE_OFFSET is changed!
function name_to_note(solfege, is_interval) {
	regex = /(d|ut|r|n|m|f|sh|s|fl|l|th|t)(u|o|a|e|i)(\d)?/;
	
	regexmatches = solfege.toLowerCase().match(regex);
	//regexmatches[0] is the original string, [1] is the consonant, [2] is the vowel, and [3] is the octave if it exists
	
	notelist = ["d","ut","r","n","m","f","sh","s","fl","l","th","t"];
	accidentallist = ["u","o","a","e","i"];
	
	//note returns 0 to 11, accidental returns 0 to 4 but needs to return -.5 to .5
	note = notelist.indexOf(regexmatches[1]) + (accidentallist.indexOf(regexmatches[2]) -2 )/4;
	octave = regexmatches[3] ?? 1;
	interval_correction = 0;
	if (is_interval) interval_correction = -24;
	return note+octave*12+12+interval_correction;
}

function note_to_freq(note) {
	return 440*2**((note-69)/12) //A is note 69 is 440hz
}

function freq_to_note(freq) {
	return 12*Math.log2(freq/440)+69 //A is note 69 is 440hz
}

function scale_degree_to_midi(deg,edo) {
	return (deg * 12 / edo)+NOTE_OFFSET;
}

function freq_interval_to_notes(f1,f2) {
	f1 = freq_to_note(f1)
	f2 = freq_to_note(f2)
	return Math.abs((f2-f1));
}

function freq_interval_to_notes(arr) {
	f1 = freq_to_note(arr[0])
	f2 = freq_to_note(arr[1])
	return Math.abs((f2-f1));
}

function calcSubset(A, res, subset, index, minSize, maxSize) {
	// Add the current subset to the result list
	if (subset.length <= maxSize & subset.length >= minSize) {
		res.push([...subset]);
	}

	// Generate subsets by recursively including and excluding elements
	for (let i = index; i < A.length; i++) {
		// Include the current element in the subset
		subset.push(A[i]);

		// Recursively generate subsets with the current element included
		calcSubset(A, res, subset, i + 1, minSize, maxSize);

		// Exclude the current element from the subset (backtracking)
		subset.pop();
	}
}

//find all subsets in set A
function subsets(A, minSize, maxSize) {
	const subset = [];
	const res = [];
	let index = 0;
	calcSubset(A, res, subset, index, minSize, maxSize);
	return res;
}

function table_from_2d_array(tableData,parent) {
	var table = document.createElement('table');
	var tableBody = document.createElement('tbody');

	tableData.forEach(function(rowData) {
		var row = document.createElement('tr');

		rowData.forEach(function(cellData) {
			var cell = document.createElement('td');
			cell.appendChild(document.createTextNode(cellData));
			row.appendChild(cell);
		});

		tableBody.appendChild(row);
	});

	table.appendChild(tableBody);
	parent.appendChild(table);
}


const Partials = {
	//preset 0: generic odds and evens (saw)
	//preset 1: generics odds (square)
	//preset 2: 3 harmonicity fm patch
	//preset 3: 4 harmonicity fm patch
	//preset 4: bell style fm patch (has a minor third)
	
	//6 harmonics is extremely detailed and good enough for the scientific research...
	//in practice anything over 3 harmonics is insanely slow because of how quickly
	//the dissonance calculaton grows (power sets!)
	
	//it doesn't matter because I have chosen tones with only 3 harmonics for the instruments
	
	// quick amplitude conversion
	// .1    = -10dB (by definition)
	// .125 ~=  -9dB
	// .2   ~=  -7dB
	// .25  ~=  -6dB
	// .5   ~=  -3dB
	// .633 ~=  -2dB
	
			SAW:    [[1,1],[2,.5],    [3,.333]],//,[4,.25],[5,.2]],[6,.167]];
			SQUARE: [[1,1],[3,.5],    [5,.333]],//,[7,.25],[9,.2]]//,[11,.167]]
			FM3:    [[1,1],[2,.125],  [4,.125]],
			FM4:    [[1,1],[3,.125],  [5,.125]],
			FMBELL: [[1,1],[2.4,.125],[4.375,.125]]  //using 12/5 and 35/8
}

//calculate dissonance and normalized dissonance from a set of frequencies and a preset harmonic series
//normalized dissonance accounts for size of the set of frequencies
//use the above enums for passing sets of harmonics
function calc_dissonance(freqs,harms) {
	let all_harms = [];
	for (let i in freqs) {
		for (let j in harms) {
			all_harms.push( [ harms[j][0]*freqs[i], harms[j][1] ] );
		}
	}
	let all_subsets_of_harms = subsets(all_harms,2,2);
	
	dissonance = 0;
	for (let i in all_subsets_of_harms) {
		if (all_subsets_of_harms[i][0][0] > all_subsets_of_harms[i][1][0]) {
			dissonance += vassilakis_roughness( all_subsets_of_harms[i][1][0], all_subsets_of_harms[i][0][0], all_subsets_of_harms[i][1][1], all_subsets_of_harms[i][0][1]);
		} else {
			dissonance += vassilakis_roughness( all_subsets_of_harms[i][0][0], all_subsets_of_harms[i][1][0], all_subsets_of_harms[i][0][1], all_subsets_of_harms[i][1][1]);
		}
	}
	normalized_dissonance = dissonance / all_subsets_of_harms.length * 100
	return [dissonance,normalized_dissonance];
}

//characteristic interval: the most dissonant interval in the voicing.
//input: list of frequencies and a list of harmonics, outputs an interval in notes
function calc_characteristic_interval(freqs,harms) {
	freq_pairs = subsets(freqs,2,2);
	highestscore = 0;
	highestind = 0;
	//iterate through all possible pairs of freqs and select most dissonant
	for (let i in freq_pairs) {
		score = calc_dissonance(freq_pairs[i],harms)[0];
		if (score > highestscore) {
			highestscore = score;
			highestind = i;
		}
	}
	return freq_interval_to_notes( freq_pairs[highestind] );
}

//median interval: the average interval, in notes.
function calc_median_interval(freqs) {
	freq_pairs = subsets(freqs,2,2);
	intervals = freq_pairs.map( freq_interval_to_notes );
	intervals.sort( (a,b)=>a-b );
	return intervals[Math.floor(intervals.length/2)];
}



//from Vassilakis' Perceptual and Physical Properties of Amplitude Fluctuation (2001)
//p. 219
function vassilakis_roughness(f1,f2,a1,a2) {
	let s = 0.24 / (0.0207 * f1 + 18.96);
	let diff = f2 -f1;
	return (a1 * a2) ** 0.1 * 0.5 * (2*a2/(a1+a2)) ** 3.11 * (Math.exp(-3.5 * s * diff) - Math.exp(-5.75 * s * diff));
}


function voicing_to_id(voicing,edo=EDO) {
	let sum = 0;
	for (let i of voicing) {
		sum += 2**i;
	}
	//a voicing's id is a big binary number 
	//where the 1s are which notes are included
	//we don't need to know if the root note is there
	//because its always there. bit shift right
	return edo.toString() + "." + (sum >> 1).toString();
}

// returns [edo,voicing]
function id_to_voicing(id) {
	id_parts = id_split(id);
	edo = id_parts[0];
	
	i = 0;
	voicing = [0]
	while ((id_parts[1] >> i) > 0) {
		if (id_parts[1] >> i & 1) voicing.push(i+1);
		i++;
	}
	return [edo, voicing];
}

// for "a.bbbbb" returns [a,bbbbb]
function id_split(id) {
	return id.match( /(\d+)\.(\d+)/ ).splice(1,3);
}

function id_to_freqs(id) {
	[edo, voicing] = id_to_voicing(id);
	return voicing.map( sd => note_to_freq(scale_degree_to_midi(sd,edo)) );
}


function array_is_equal(a, b) {
	if (a === b) return true;
	if (a == null || b == null) return false;
	if (a.length !== b.length) return false;

//don't mutate a and b! also it doesn't matter that it is sorting alphabetically here. which is what sort() does by default.
	let a2 = Array.from(a).sort()
	let b2 = Array.from(b).sort()

	for (var i = 0; i < a2.length; ++i) {		
		if (a2[i] !== b2[i]) return false;
	}
	return true;
}

//intervals are all the same
function voicing_delta_is_equal( vd ) {
	for (let i in vd) {
		if (vd[i] != vd[0]) return false;
	}
	return true;
}

//intervals only get smaller
function voicing_delta_is_pyramid( vd ) {
	let a = vd[0]
	for (let i in vd) {
		if (vd[i] > a) return false;
		if (vd[i] < a) a = vd[i];
	}
	return true;
}

//intervals only get bigger
function voicing_delta_is_inv_pyramid( vd ) {
	let a = vd[0]
	for (let i in vd) {
		if (vd[i] < a) return false;
		if (vd[i] > a) a = vd[i];
	}
	return true;
}




//set theory stuff, uses arrays of notes

function remove_duplicates(A) {
	return A.sort((a, b) => a - b).filter(function(item, pos, ary) {
		return !pos || item != ary[pos - 1];
	});
}

//
function notes_to_reduced_set(voicing_notes) {
	//calculate unreduced set
	let A = voicing_notes.map(e => e%=12);
	A = remove_duplicates(A);
	
	//calculate how far apart the notes are
	let B = [];
	for (let i = 0; i<A.length; i++) {
		B[i] = Math.abs( A.at(i) - A.at(i-1) );
		if (i==0) B[i] = 12 - B[i];
	}
	//The note farthest away from the previous note should be moved to 0
	//(this variable is also useful for making chords play in the same key)
	amountToRotate = A[ B.indexOf(Math.max(...B)) ];
	
	A = A.map(
		e => ( 
			e = (e - amountToRotate + 12) % 12,
			e = e==10?"A":e==11?"B":e //replace 10 and 11 with A and B
		)
	);
	A.sort((a, b) => parseInt(a,12) - parseInt(b,12)); //A now contains readable sorted and reduced set
	
	return A;
}

function find_name_of_reduced_set(reduced_set) {
	return CHORD_NAMES[reduced_set.join("")] ?? "";
}






















let notesset = [];
for (let i = 1; i < VOICING_MAX_WIDTH + 1; i++) {
	notesset.push(i);
}

console.log("generating voicing subsets...");
// these voicing subsets are re used for every edo, e.g. one of the subsets might be "0 7 12"
// which is a fifth and an octave in 12edo but an octave and a major sixth in 7edo
// the problem is, regular sized voicings in 19edo then become insanely wide in 7edo.
let allvoicings = subsets(notesset, VOICING_MIN_NOTES - 1, VOICING_MAX_NOTES - 1);

for (let i in allvoicings) {
	allvoicings[i] = allvoicings[i].map(v => (v+VOICING_BASS_INTERVAL_WIDTH - 1));
	allvoicings[i].unshift(0); //add 0 to start
}
VOICING_TABLE = [];

//EDOS_TO_GENERATE = [12];
for (let j of EDOS_TO_GENERATE) {
	EDO = j;
			
	console.log(`generating table for edo ${EDO}...`);

	VOICING_TABLE_THIS_EDO = [];
	
	for (let i in allvoicings) {
		//generate statistics for voicings here. remember: the database needs to be
		//under 100MB. the less letters you use for a key (e.g. ".voicing") the smaller
		//the json file ends up. do not save something into the database if it is only
		//used as an intermediate. arrays of floats are giant!!!
		
		//it turns out the array of midi notes and array of freqencies of notes aren't
		//actually referenced ever. I was able to stop saving the .voicing value as
		//well just by calculating it from the ID whenever it was needed.

		VOICING_TABLE_THIS_EDO[i] = {};
		//VOICING_TABLE_THIS_EDO[i].voicing = allvoicings[i];
		VOICING_TABLE_THIS_EDO[i].notes = allvoicings[i].length;
		
		
		VOICING_TABLE_THIS_EDO[i].edo = EDO;
		VOICING_TABLE_THIS_EDO[i].id = voicing_to_id(allvoicings[i]);
		
		//convert each scale degree to midi
		let voicing_midi = allvoicings[i].map(x => scale_degree_to_midi(x,EDO));
		//VOICING_TABLE_THIS_EDO[i].voicing_midi = voicing_midi;
		
		//width is equal to the highest scale degree (since the lowest scale degree is always 0)
		VOICING_TABLE_THIS_EDO[i].w = allvoicings[i].slice(-1)[0];
		//once we calculate the width in notes, we know how big the chord is. if it's over the threshold
		//stop doing calculations for this voicing and remove it from the table
		VOICING_TABLE_THIS_EDO[i].w_notes = ( scale_degree_to_midi(VOICING_TABLE_THIS_EDO[i].w,EDO) - NOTE_OFFSET );
		if (VOICING_TABLE_THIS_EDO[i].w_notes > VOICING_CUTOFF_THRESHOLD_NOTES) {
			VOICING_TABLE_THIS_EDO[i] = null;
			continue;
		}
		
		VOICING_TABLE_THIS_EDO[i].w_notes_r = note_to_name( VOICING_TABLE_THIS_EDO[i].w_notes + 24, true );
		
		//first interval
		VOICING_TABLE_THIS_EDO[i].fi = allvoicings[i].slice(1,2)[0];
		VOICING_TABLE_THIS_EDO[i].fi_notes = ( scale_degree_to_midi(VOICING_TABLE_THIS_EDO[i].fi,EDO) - NOTE_OFFSET );
		
		//"rounded 12edo set"
		let r12s = notes_to_reduced_set(voicing_midi.map( n => Math.round( n - NOTE_OFFSET ) ));
		let r12s_name = find_name_of_reduced_set( r12s );
		
		//only add to r12s name and confidence to database if exists.
		//confidence: rounded all the notes and nothing changed: 100 confidence
		//			  rounded all the notes and all of them changed by 50 cents: 0 confidence
		if (r12s_name) {
			VOICING_TABLE_THIS_EDO[i].r12s_name = r12s_name;
			//error is how far away the rounding moved the note
			let total_error = voicing_midi.map( n => Math.abs( (n - NOTE_OFFSET) - Math.round( n - NOTE_OFFSET ) ) ).reduce((a,b)=>a+b);
			let confidence = 100 - (200 * total_error / allvoicings[i].length);
			VOICING_TABLE_THIS_EDO[i].r12s_conf = confidence;
		}
		
		//convert each midi note to freq
		voicing_freq = voicing_midi.map(note_to_freq);
		//VOICING_TABLE_THIS_EDO[i].voicing_freq = voicing_freq;
		
		voicing_readable = voicing_midi.map(x => note_to_name(x,true));
		VOICING_TABLE_THIS_EDO[i].voicing_r = voicing_readable;
		
		VOICING_TABLE_THIS_EDO[i].d  = calc_dissonance(voicing_freq,Partials.FM3)[1];
		VOICING_TABLE_THIS_EDO[i].d3 = calc_dissonance(voicing_freq,Partials.FM4)[1];
		VOICING_TABLE_THIS_EDO[i].db = calc_dissonance(voicing_freq,Partials.FMBELL)[1];
		
		//characteristic interval and median interval
		//these intervals are in midi notes
		VOICING_TABLE_THIS_EDO[i].ci = calc_characteristic_interval(voicing_freq,Partials.FM3);
		VOICING_TABLE_THIS_EDO[i].ci_r = note_to_name( VOICING_TABLE_THIS_EDO[i].ci + 24, true );
		VOICING_TABLE_THIS_EDO[i].mi = calc_median_interval(voicing_freq);
		VOICING_TABLE_THIS_EDO[i].mi_r = note_to_name( VOICING_TABLE_THIS_EDO[i].mi + 24, true );
		
		
		//finally, calculate "attributes": these pop up when hovering over voicings. 
		//they are stored as single characters in a string to save space.
		//if a voicing is 2 notes it's stupid to call it a mirror chord or "equi-
		//distant" or whatever so don't even bother.
		if (allvoicings[i].length > 2) {
			let attributes = "";
			
			//voicing delta is distance between each note, aka, its the intervals that make up the chord. this array is one less in length than the voicing.
			let voicing_delta = [];
			for (let j = 1; j<allvoicings[i].length; j++) {
				voicing_delta.push(allvoicings[i][j] - allvoicings[i][j-1]);
			}
			
			if ( voicing_delta_is_equal(voicing_delta) ) {
				attributes += "me";
			} else {
				//does a voicing equal itself flipped upside down? if yes give it "m" mirror attribute.
				//equally spaced means its also a mirror chord hence its placement here. a lot of these
				//attributes are mutually exclusive
				if ( array_is_equal( allvoicings[i], allvoicings[i].map( n=>VOICING_TABLE_THIS_EDO[i].w-n ).sort( (a,b)=>a>b ) ) ) {
					attributes += "m";
				} else {
					//pyramids and inverted pyramids only are interesting attributes if
					//the chord has 4 or more notes, in my opinion. since every chord
					//with 3 notes is one or the other. gratuitous else if for speeeed.
					if (allvoicings[i].length > 3) {
						if (voicing_delta_is_pyramid(voicing_delta)) {
							attributes += "p";
						} else {
							if (voicing_delta_is_inv_pyramid(voicing_delta)) attributes += "i";
						}
					}
				}
			}
			
			if (attributes) VOICING_TABLE_THIS_EDO[i].a = attributes;
		}
		
		
	}
	
	//we need to cut out all of the voicings that passed the cutoff threshold.
	//earlier they were turned into null, so when we add this edo's voicings
	//to the master table we'll just filter them out.
	VOICING_TABLE = VOICING_TABLE.concat( VOICING_TABLE_THIS_EDO.filter( x => x!=null ) );
}

fs.writeFileSync('table.js', "VOICING_TABLE = " + JSON.stringify(VOICING_TABLE));
