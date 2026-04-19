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