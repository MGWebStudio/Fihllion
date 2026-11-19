// Common first names and surnames. Typed on their own, they could mean thousands of people, so the
// referee's yes doesn't count for them (shared.js). Without this, "james" for an NFL quarterback
// or "chris" for a baseball player let the referee pick some obscure person with that name, which
// scored as a Deep Cut. Answers on a prompt's own list never reach these checks.

export const FIRST_NAMES = new Set(`
aaron abby abigail adam addison adrian aiden alan albert alex alexa alexander alexandra alexis alice
alicia allison amanda amber amelia amy andre andrea andrew andy angel angela anna anne annie anthony
april ariana ashley aubrey austin ava avery bailey barbara becky ben benjamin beth betty bill billy
blake bob bobby brad bradley brandon brenda brian brianna brittany brooke bruce bryan bryce caleb
cameron carl carlos carol caroline carson carter casey catherine charles charlie charlotte chase chloe
chris christian christina christine christopher cindy claire cody colin colton connor cooper courtney
craig crystal cynthia dakota dan dana daniel danielle danny dave david dean debbie deborah dennis derek
diana diane dominic don donald donna doug douglas drew dustin dylan easton eddie edward elena eli
elijah elizabeth ella ellie emily emma eric erica erin ethan eva evan evelyn frank gabe gabriel gary
gavin george grace grant greg gregory hailey haley hannah harper harry hayden heather helen henry
holly hunter ian isaac isabel isabella isaiah jack jackie jackson jacob jaden jake james jamie jane
janet jared jasmine jason jay jayden jeff jeffrey jenna jennifer jenny jeremy jerry jesse jessica jill
jim jimmy joe joel joey john johnny jon jonathan jordan jose joseph josh joshua joy juan julia julian
julie justin kaitlyn karen kate katelyn katherine kathy katie kayla kaylee keith kelly kelsey ken
kendall kenneth kevin kim kimberly kyle kylie landon larry laura lauren layla leah lee leo levi liam
lily lincoln linda lindsay lisa logan lori louis lucas lucy luke lydia mackenzie madison maggie
makayla mallory marcus margaret maria mark mary mason matt matthew max maya megan melissa mia michael
michelle mike miles molly morgan nancy natalie nate nathan nicholas nick nicole noah nolan olivia
owen paige pam pamela parker patricia patrick paul peter peyton philip phillip rachel randy rebecca
riley rob robert robin ron ronald ross ruby russell ryan sam samantha samuel sandra sara sarah savannah
scott sean seth shane shannon sharon shawn sierra skylar sophia sophie spencer stephanie stephen steve
steven sue susan sydney tanner taylor teresa terry thomas tiffany tim timothy todd tom tommy tony
travis trevor tristan troy tyler valerie vanessa victor victoria vincent walter wayne wes wesley will
william wyatt zach zachary zoe
`.trim().split(/\s+/));

export const SURNAMES = new Set(`
adams allen alvarez anderson bailey baker barnes bell bennett brooks brown bryant butler campbell
carter castillo chavez clark collins cook cooper cox cruz davis diaz edwards evans fisher flores ford
foster garcia gibson gomez gonzalez gray green griffin hall hamilton harris hayes henderson hernandez
hill howard hughes jackson james jenkins johnson jones jordan kelly kennedy kim king lee lewis long
lopez martin martinez mason miller mitchell moore morales morgan morris murphy myers nelson nguyen
ortiz owens parker patel perez perry peterson phillips powell price ramirez reed reyes richardson
rivera roberts robinson rodriguez rogers ross russell sanchez sanders scott simmons smith stewart
sullivan taylor thomas thompson torres turner walker ward washington watson white williams wilson
wood wright young
`.trim().split(/\s+/));
