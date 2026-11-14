---
title: Research, direction of the 30 s demo video
updated: 2026-11-14
verified_by: Space Apps guides read with curl -k on 14 Nov 2026 (TLS certificate not verified); 2025 Global Winner demo links from https://api.spaceappschallenge.org/graphql, files downloaded and measured with ffprobe, ffmpeg ebur128, silencedetect, scene filter and a faster-whisper tiny transcript; other sources fetched as page text (curl, WebFetch, or the r.jina.ai text proxy for Medium, TED, Meta, TikTok, YouTube Blog, SWD, Duarte), Coats from a Wayback snapshot of her own blog; v5 timings computed from video/index.html and video/compositions/*.html and checked on frames of out/burning-calendar-roughcut-v5.mp4
sources: [https://www.spaceappschallenge.org/resources/project-submission-guide/, https://www.spaceappschallenge.org/resources/judging-awards-guide/, https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/, https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977, https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617, https://idl.cs.washington.edu/files/2007-AnimatedTransitions-InfoVis.pdf, https://faculty.cc.gatech.edu/~stasko/papers/infovis08-anim.pdf, https://idl.cs.washington.edu/files/2010-Narrative-InfoVis.pdf, https://www.ted.com/talks/hans_rosling_the_best_stats_you_ve_ever_seen/transcript, https://support.google.com/google-ads/answer/14783551, https://developer.apple.com/app-store/app-previews/, https://support.google.com/googleplay/android-developer/answer/9866151, https://aes.org/wp-content/uploads/2024/01/AESTD1004_1_15_10.pdf, https://tech.ebu.ch/docs/r/r128.pdf, https://pixabay.com/service/license-summary/, https://support.google.com/youtube/answer/3376882]
---

Research for the next edit of the 30 s demo (cut v5, `video/` in the `video` worktree), 14 Nov 2026. Rules, past winners and pitch advice already in [../space-apps-rules.md](../space-apps-rules.md), [../past-winners.md](../past-winners.md) and [2026-11-13-research-how-to-win.md](2026-11-13-research-how-to-win.md) are cited, not repeated. READ = quote read on the page itself. UNVERIFIED-SNIPPET = seen only in a search result or secondhand.

This file is not edited later. New material goes into a new dated file.

## 1. Space Apps 2026: what the guides say about the demo video

Read on the pages with `curl -k` on 14 Nov 2026 (TLS certificate not verified from our machine). Short codes S and J as in [2026-11-13-research-how-to-win.md](2026-11-13-research-how-to-win.md); only material not already in that file or in [../space-apps-rules.md](../space-apps-rules.md) is listed.

- S, "Tips for Creating a Project Demo": "Your goal should be to quickly communicate the importance and relevance of your project to someone who has no context, technical background, or previous knowledge of your subject. Regardless of your demo's format, be sure to use strong visuals and ensure readability."
- S, the [0:05] step: "Titles should be short but can indicate what problem the project solves or what people gain from your project."
- S, the [0:20-0:30] step: "Look into the future: Paint a picture! Captivate your audience with what it could be; What can your proposed solution do for people, the world, and beyond?" The guide closes on future impact, not on validation numbers.
- S, Link to Project Demo: "This demo will be considered in your overall project evaluation, but the majority of judges' evaluation will be based on your project submission. Note: a strong project demo can increase the potential for a high score in the Presentation category."
- S, "Plan Ahead": consider the question "What story does my team want to tell?"
- S, SI rules for sound: "Audio: Must acknowledge SI generation in descriptive text and metadata." Images and videos need a visible watermark; audio does not, but it needs the text acknowledgement (project page References or description) and a metadata tag in the file.
- J, Presentation, score 5 ("Exceptional Communication and Storytelling"): "The team delivered a well-structured and compelling presentation, clearly articulating the challenge, proposed solution, and importance of the project. Their storytelling was engaging ... The delivery was polished, structured, and highly effective."
- J, submission checkbox: "my team has not used any copyrighted materials (i.e., music, images, text, etc.) that we don't have permission to use." Music is named explicitly; any music bed needs a licence that covers this use and a line in References.
- S points to past winners as models: "Get inspired by the exceptional demos from previous NASA Space Apps Challenge Winners. Click the 'Project Tab' then scroll to the Demo section."

### Past Global Winner demos, 2025 (measured by us)

Demo links come from the public Space Apps GraphQL API (`https://api.spaceappschallenge.org/graphql`, query `teams(q:...) { awardBadges projectDetails { demoLink } }`), since the project pages render in JavaScript. Files were downloaded on 14 Nov 2026 and measured with `ffprobe`, `ffmpeg ebur128`, `silencedetect`, a scene-cut filter (threshold 0.3) and a faster-whisper `tiny` transcript. Word counts from the tiny model are approximate. 2024 winners return an empty `demoLink` field through the same query; not retrieved.

| Team, award | Demo URL | Length | Format | Voice | Opening (0-3 s) | Ending | Loudness |
|---|---|---|---|---|---|---|---|
| QUEÑARIS, Local Impact | https://youtu.be/QvbLhHqKULc | 30.4 s | animated slides, laptop mock-up of the app, drone footage | yes, about 99 words (3.3 words/s) | logo, one-line tagline "Platform for the smart reforestation of queñua forests" and app URL on frame 1; challenge name in a header on every slide | team photo with all members, tagline "Bringing back the tree of the Andes" | -16.3 LUFS |
| Resonant Exoplanets, Best Use of Data | https://www.youtube.com/watch?v=5fBB5YJpfwU | 29.9 s | talking head 1.4 s, stock space footage, scrolling technical report, app screen | yes, about 115 words (3.8 words/s) | presenter on camera, problem first ("scientists have spent years analyzing ... by hand") | app screen with GitHub and app URL | -17.9 LUFS |
| Zumorroda-X, Art & Technology | https://drive.google.com/file/d/1P-sOTecG2uO2eLu3UabS0PXWLYUKaF4p/view | 29.2 s | gameplay capture, pixel art | yes, about 79 words (2.7 words/s), opens "Hi, I'm ... from Zumorroda-X" | name and team in the first 2 s of voice, over the game's first dialogue box | gameplay | -20.8 LUFS |
| Astro Sweepers, Galactic Impact | https://drive.google.com/file/d/1L3cIR8WZdzdp7eUY3leIToGTbnMiBT4N/view | 30.5 s | dense slides, team cards, website scroll | silent for the first 23.1 s, then voice over the last slide | project title and one-line description on frame 1 | financial slide | -33.2 LUFS |
| Twisters, Best Use of Technology | https://drive.google.com/file/d/1LDaKDOHBKm3PxC03xcEJGfdybsVEwOTf/view | n/a | 6-page PDF slide deck, not a video | n/a | n/a | n/a | n/a |

Not retrieved: HerCode Space, Best Use of Storytelling ("A Solar Tale", https://youtu.be/1C9ueho9ero, YouTube asks to sign in); PureFlow, Best Mission Concept (https://youtu.be/hHUpo7bTVuc, "not available"); SpaceGenes+, Best Use of Science (Drive file not public).

What the four videos share:
- Three of four carry the story in a voice-over at 2.7 to 3.8 words per second, which fits 80 to 115 words into 30 s. None of them is text-only. The one mostly silent video (Astro Sweepers) is also the densest to read.
- Each shows the product name or the team in the first 2 s, as the S timeline asks.
- Two end on the URL or the team; none ends on a validation number.
- Two run slightly over 30.0 s (30.4 s, 30.5 s) as container duration and still won. We do not rely on this: S says projects over the limit "will not be eligible".
- Integrated loudness ranges from -33.2 to -16.3 LUFS; the three with continuous sound sit between -21 and -16 LUFS.
- None uses an animated data chart as the core shot. A chart-led, text-only cut has no direct precedent among these winners.

## 2. Short-form structure

- COATS, Emma Coats, "22 #storybasics I've picked up in my time at Pixar", her own blog, Wayback snapshot of 24 Jun 2012 (http://web.archive.org/web/20120624124010/http://storyshots.tumblr.com:80/post/25032057278/22-storybasics-ive-picked-up-in-my-time-at-pixar), READ.
  - #4, the story spine: "Once upon a time there was ___. Every day, ___. One day ___. Because of that, ___. Because of that, ___. Until finally ___."
  - #5: "Simplify. Focus. Combine characters. Hop over detours."
  - #7: "Come up with your ending before you figure out your middle."
  - #22: "What's the essence of your story? Most economical telling of it?"
  - She calls them storybasics, not rules.
- DUARTE, Nancy Duarte (https://www.duarte.com/presentation-skills-resources/move-presentation-audience-with-story-techniques-in-presentations/), READ.
  - The talk moves back and forth between "what is" and "what could be".
  - Ending: "The end of your talk needs to end with a 'new bliss'... your picture of the world with your idea adopted. Remember, people will always remember the last thing you said."
  - "Know what your 'call to action' is" (https://www.duarte.com/blog/creating-moments-of-impact-using-sparklines-for-strategic-conversations/), READ.
  - "Call to action = second turning point" comes from a Goodreads note, not from Duarte: UNVERIFIED-SNIPPET.
- RASKIN, Andy Raskin, "The Greatest Sales Deck I've Ever Seen" (https://medium.com/the-mission/the-greatest-sales-deck-ive-ever-seen-4f4ef3391ba0), READ.
  - Step 1, "Name a Big, Relevant Change in the World": "the undeniable shift in the world that creates both (a) big stakes and (b) huge urgency". He advises against opening with "the problem".
  - Step 3: "the Promised Land is a new future state, not your product or service".
  - Step 4: features come as "Magic Gifts".
  - Step 5: "Present Evidence that You Can Make the Story Come True". Demos are "the next most effective evidence" after customer success stories.
  - Our opener, "MODIS ends in 2027", is a Raskin-type change. Validation numbers are his step 5 evidence.
- ABCD, Google Ads Help, "ABCDs of effective video ads" (https://support.google.com/google-ads/answer/14783551), READ.
  - Attention: "Jump in. Get to the heart of the story faster, and use engaging pacing and tight framing."
  - "Reinforce your message with audio and text. Avoid competing elements."
  - Branding: "Introduce your brand or product from the start and maintain that presence."
  - Connection: "Keep messaging and language focused and simple."
  - Direction: "add a CTA ... Say what you'd like viewers to do."
  - The business.google.com version gives "introduces its brand in the first 5s" as a positive example and claims a "30% lift in short-term sales likelihood", Google's own figure (https://business.google.com/us/resources/articles/abcds-of-effective-video-ads/), READ.
- YT, YouTube Blog.
  - "Start with a question... The human brain will always want an answer to a question posed." Also: "Within the first five seconds the viewer knows exactly what this video will be." (https://blog.youtube/creator-and-artist-stories/four-tips-to-hook-your-viewers-on/), READ.
  - Shorts guide: "Capture attention in the first few seconds to prevent viewers from scrolling." (https://blog.youtube/creator-and-artist-stories/your-guide-to-getting-started-with-youtube-shorts/), READ.
- TIKTOK, TikTok Ads creative best practices (https://ads.tiktok.com/help/article/creative-best-practices?lang=en), READ.
  - "Have a hook, highlight your unique selling points, and end with a clear call-to-action."
  - "Introduce your content proposition in the first 3 seconds."
  - "We recommend displaying 5-10 words per second when using text." This is an ad-feed figure for short captions. It conflicts with BBC (section 4) by a factor of 2 to 3. For a judged demo with dense numbers we follow BBC.
- META, Meta for Business, READ.
  - "Design for sound off... 41% of videos were basically meaningless without sound" (https://www.facebook.com/business/news/updated-features-for-video-ads).
  - "65% of people who watch the first three seconds of a video will watch for at least ten seconds." Meta's own figure, undated page.
  - "Build for sound off. Delight with sound on." Also: "Make it as short as it can be, and as long as it needs to be." (https://www.facebook.com/business/news/want-to-better-video-ads-for-mobile-well-show-you-how).

## 3. Data storytelling on screen

- SWD, Cole Nussbaumer Knaflic, storytellingwithdata.com, READ.
  - Big Idea: "boils down the 'so-what'... to a single sentence"; it "must articulate your unique point of view; ...convey what's at stake; ...be a complete sentence" (https://www.storytellingwithdata.com/blog/2014/02/whats-big-idea).
  - Labels: "move the legend directly next to the data, reducing the mental effort of going back and forth" (https://www.storytellingwithdata.com/blog/2021/1/10/lets-improve-this-graph-yt9xj).
  - Progressive reveal: "build a graph or story one component at a time... piece by piece" (https://www.storytellingwithdata.com/blog/2018/9/12/animating-data).
  - "One of the most common traps... is trying to show everything at once... reveal one idea at a time" (https://www.storytellingwithdata.com/blog/my-favorite-makeover-that-didnt-make-the-book).
- ROSLING, Hans Rosling, TED 2006 transcript (https://www.ted.com/talks/hans_rosling_the_best_stats_you_ve_ever_seen/transcript), READ. His order on the animated chart:
  1. Encoding: "Every bubble here is a country... The size of the bubble is the population".
  2. Axis ranges: "up to about eight children per woman".
  3. The question: "Are the students right? It's still two types of countries?"
  4. Only then the play: "Let's see. We start the world".
- HEER07, Heer and Robertson, "Animated Transitions in Statistical Data Graphics", InfoVis 2007 (https://idl.cs.washington.edu/files/2007-AnimatedTransitions-InfoVis.pdf), READ.
  - "Use simple transitions. Complicated transforms with unpredictable motion paths or multiple simultaneous changes result in increased cognitive load."
  - "Use staging for complex transitions... separating axis rescaling from value changes may help."
  - "Make transitions as long as needed, but no longer... recommend transition times around 1 second."
  - From their experiments: "recommend timing each stage around a full second, rather than around a half-second each."
- ROB08, Robertson et al., "Effectiveness of Animation in Trend Visualization", InfoVis 2008 (https://faculty.cc.gatech.edu/~stasko/papers/infovis08-anim.pdf), READ.
  - Animation "is the fastest technique for presentation and participants find it enjoyable and exciting", but "it does lead to many participant errors".
  - What made Rosling's presentations work: "having a narrator explaining what the data was doing, and highlighting important features". In a text-only cut the captions take the narrator's place.
  - Their trend animation ran at 2.5 years of data per second, and most participants found it "neither too fast nor too slow".
- SEGEL10, Segel and Heer, "Narrative Visualization: Telling Stories with Data", InfoVis 2010 (https://idl.cs.washington.edu/files/2010-Narrative-InfoVis.pdf), READ.
  - Film is the purely author-driven case: "a strict linear path... relies heavily on messaging, and includes no interactivity". It "works best when the goal is storytelling or efficient communication."
  - Martini glass: author-driven first, then the reader explores. For us: the video is the stem, the app and MCP server are the glass.
- JBM, John Burn-Murdoch, FT, READ.
  - "if you give it a title that makes a point, you're going to get a stronger reaction" (https://eyemagazine.com/feature/article/conversation-with-john-burn-murdoch).
  - "use repetition to actually demonstrate how past years all look very similar, creating an expectation... and then shatter that expectation" (quoted in https://flourish.studio/2021/01/19/masters-reveal-line-john-burn-murdoch/).
- TSE, Archie Tse, NYT, Malofiej 2016 slides (https://github.com/archietse/malofiej-2016), READ.
  - "If you make a tooltip or rollover, assume no one will ever see it. If content is important for readers to see, don't hide it."
  - Our app shot relies on a click and a panel. The caption must carry the number.
- Not found: first-party FT or Pudding writing on video chart pacing. Also no first-party rule for how long a key number must stay on screen. The closest standard is BBC 4.3.6, extra time for long figures (section 4).

## 4. Reading time and silent viewing

- BBC, BBC Subtitle Guidelines (https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/; the bbc.github.io address returns 404), READ.
  - "The recommended subtitle speed is 160-180 words-per-minute (WPM) or 0.33 to 0.375 second per word." That is 2.7 to 3.0 words per second, so 30 s holds 80 to 90 words.
  - Floor: "a minimum period of around 0.3 seconds per word (e.g. 1.2 seconds for a 4-word subtitle)."
  - 4.3.4: "When there is a lot happening in the picture, e.g. a football match or a map, allow viewers enough time both to read the subtitle and to take in the visuals."
  - 4.3.6 and 4.3.7: more time for long figures ("e.g. 12,353") and for text across a shot change. Labels: "Allow an extra second."
  - 4.5: a gap between subtitles "must be a minimum of one second, preferably a second and a half."
  - 6.3: "Avoid creating subtitles that straddle a shot change."
- NFLX-EN, Netflix English (USA) Timed Text Style Guide (https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977), READ: "Adult programs: Up to 20 characters per second"; children up to 17; 42 characters per line.
- NFLX-GEN, Netflix General Requirements (https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617), READ: "Minimum duration: 5/6 (five-sixths) of a second per subtitle event"; "Maximum duration: 7 seconds"; 2 lines maximum.
- NFLX-TIM, Netflix timing guidelines (https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394), READ: gaps "should either be 2 frames or half a second or more" (15 frames at 30 fps).
- CHROME, Chrome autoplay policy (https://developer.chrome.com/blog/autoplay), READ: "Muted autoplay is always allowed." Unmuted autoplay needs a prior user gesture.
- WEBKIT, WebKit video policies for iOS (https://webkit.org/blog/6784/new-video-policies-for-ios/), READ: "<video muted> elements will also be allowed to autoplay without a user gesture."
- APPLE-AP, Apple App Store app previews (https://developer.apple.com/app-store/app-previews/), READ: "By default, app previews play with the sound muted, so consider using copy... Ensure text is legible, is easy to understand, and remains on the screen long enough for people to read."
- WCAG 2.2.2 (https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html), READ. Relevant only if the video autoplays inside the web app: moving content that starts automatically and lasts over 5 s needs a pause control.
- NNG, Aurora Harley, Nielsen Norman Group, READ.
  - For an overview, not a tutorial: "make it as short as possible ... under 30 seconds is a good goal". Viewers started checking the remaining time "about 30 seconds into the video". (https://www.nngroup.com/articles/video-image-details/)
  - Viewers complained that videos "don't get to the point quickly enough" (https://www.nngroup.com/articles/instructional-video-guidelines/).
- Judges may watch with sound on, but the demo link is opened inside a browser where muted autoplay is the default. A text-only cut is the right base. It must simply be readable.

## 5. Music and sound

- MAYER, Moreno and Mayer 2000, J. Educ. Psych. 92(1):117-125 (https://tecfa.unige.ch/tecfa/teaching/methodo/Moreno_Mayer00.pdf), READ: "groups receiving music performed worse than groups not receiving music" on retention and transfer. The study used narrated lessons, not a text-only ad, so it argues for a quiet bed or none, not for silence over sound.
- Winners (section 1): all four measured 2025 demos have a sound track. Three carry a voice. Our silent cut is the outlier.
- YT-LOUD, YouTube Help "Stable volume" (https://support.google.com/youtube/answer/14106294), READ. It "balances the range between quiet and loud" and is on by default. Google publishes no LUFS target. The common "-14 LUFS" figure appears only in third-party sources.
- EBU, EBU R 128-2023 (https://tech.ebu.ch/docs/r/r128.pdf), READ: "normalised to a Target Level of −23.0 LUFS"; true peak "shall not exceed −1 dBTP". This is the broadcast target, too quiet next to web video.
- AES1004, AES TD1004.1.15-10 (https://aes.org/wp-content/uploads/2024/01/AESTD1004_1_15_10.pdf), READ. Streams should "not exceed -16 LUFS" and "not be lower than -20 LUFS", with peaks "not exceed −1.0 dB TP". AES TD1008 reportedly sets -18 LUFS for speech: UNVERIFIED-SNIPPET.
- Licences:
  - YTAL, YouTube Audio Library (https://support.google.com/youtube/answer/3376882), READ.
    - Creative Commons tracks need credit in the video description. Tracks under the standard licence need none.
    - The page does not say whether tracks may be used off YouTube, for example in a Drive-hosted file.
  - PIXABAY, Pixabay Content License (https://pixabay.com/service/license-summary/), READ.
    - "Use Content without having to attribute the author."
    - FAQ (https://pixabay.com/service/faq/), READ: "Tracks displaying a shield icon are registered with Content ID and may trigger claims."
  - FMA, Free Music Archive FAQ for videos (https://freemusicarchive.org/FAQ_For_Videos), READ.
    - CC BY credit must appear "in the video as well as in any written blurb".
    - ND tracks cannot be synced, because "syncing a track to visual media is considered making a 'Derivative Work'".
    - NC tracks are excluded from commercial videos.
- Space Apps:
  - Any track goes into References, because the submission checkbox names music among the copyrighted materials (J, section 1).
  - AI-generated music is allowed, but S requires "Audio: Must acknowledge SI generation in descriptive text and metadata". That means a line in the project page and a metadata tag in the file, for example an ffmpeg `-metadata comment=`.
  - Judges see that acknowledgement and judge "originality, intent, and execution" ([2026-11-13-research-how-to-win.md](2026-11-13-research-how-to-win.md)).
  - A licensed human-made track avoids the question.
- APPLE-AP, READ: "consider using a single musical score or soundtrack throughout".

## 6. Directing a screen recording

- APPLE-AP (https://developer.apple.com/app-store/app-previews/), READ.
  - "Ensure that any transitions between scenes don't imply functionality that your app doesn't include."
  - "We recommend capturing the native UI resolution rather than zooming in on the view."
  - "Avoid any seasonal or timely references that will age your video."
  - Choose "a visually compelling poster frame".
- APPLE-SPEC (https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications), READ: 15 to 30 s, at most 30 fps.
- GPLAY, Google Play preview video guidelines (https://support.google.com/googleplay/android-developer/answer/9866151), READ.
  - Show the real app "as early as possible within the first 10 seconds".
  - "Aim for at least 80% of the video to be representative of the user experience". "Limit title screens, logos." "Use captions".
  - These are store rules for an app ad. A Space Apps demo also has to show the science, so the 80 % share does not transfer. The 10 s rule does.
- SSTUDIO, Screen Studio docs (https://screen.studio/guide/auto-zoom, https://screen.studio/guide/cursor), READ.
  - "The Auto zoom option focuses on the areas where clicks occurred."
  - "Hide cursor if it's not moving."
  - No zoom levels or timings given.
- ZOOMIT, Microsoft PowerToys ZoomIt (https://learn.microsoft.com/en-us/windows/powertoys/zoomit), READ: "The default magnification level is 2.0" (range 1.25 to 4.0), with zoom animation on by default.
- HEER07 applies to the camera as well: one change per stage, about 1 s. A zoom that runs while a caption changes is two simultaneous changes.
- Not found: first-party posts from Linear, Vercel or Figma on how they direct product videos. No first-party number for how long to hold before or after a click.

## Checklist against v5

Times are film time. Scene offsets come from `video/index.html`, element times from the clip `data-start`/`data-duration` and the GSAP positions in `video/compositions/*.html`. Word counts include every visible text element in the scene. Reading need = words × 0.33 s (BBC), plus 1 s when the text sits over a moving map or chart (BBC 4.3.4).

1. **Whole film, word budget: FAIL.** About 326 words are on screen in 30 s (intro 52, fires 27, MCP 63, app 29, chart 72, numbers 41, end card 42), or 10.9 words/s. BBC's 2.7 to 3.0 words/s allows 80 to 90 words. The voiced 2025 winners used 79 to 115. Target 90 words or fewer, counting headers and source lines. (BBC; our measurements, section 1)
2. **intro 0-3.5 s, hook: PASS.** "How will we track fires in 2027?" has 7 words and is on screen from frame 0 to 3.5 s. It needs 2.3 s. It opens on a question (YT, ROSLING) and on a Raskin-type change (RASKIN). Keep it.
3. **intro 1.5-3.5 s, subline: FAIL.** "MODIS, the fire record since 2000, switches off. VIIRS counts fires differently." has 12 words for 2.0 s. It needs 4.0 s, or 5.0 s over the animating timeline. It competes with a 13-word header, a 10-word source line and the timeline labels. Cut it to 6 words or fewer, or drop it and let the bars say it. (BBC, HEER07 "multiple simultaneous changes")
4. **Project name: FAIL.** "Burning Calendar" first appears at 27.1 s. S puts the title and tagline at 0:05, and ABCD says "introduce your brand ... from the start". All four measured winners show the name or team within 2 s. The team name and challenge are in the 0 s header (pass). Add the product name by 5 s, for example in the intro header. (S, ABCD, section 1)
5. **fires 3.5-6 s: FAIL.** Title and subtitle have 12 words for 2.5 s over a moving map with a running date and counter. They need 5.0 s with the BBC map allowance. The source line adds 9 more words. "Evia" (1 word, 1.4 s) passes. Keep one 5-word line, for example "Greece, summer 2021: every dot a detection". Move the source line to the end card or the project page. (BBC 4.3.4, SWD "one idea at a time")
6. **MCP 6-10.5 s: FAIL on load, PASS on the key line.**
   - Key line, pass: "4,235 detections · 67× the August median" has 6 words for 3.15 s (needs 2.0 s).
   - Load, fail: the scene shows 63 words in 4.5 s. The detail line plus two tags add 19 words in 3.15 s (need 6.3 s), and the source line adds 9 more.
   - Fix: 4.5 s at 3 words/s holds about 13 words. The title (7) and the result line (6) are the text to read. The question bubble and the tool call can stay as chat texture that judges skim. Cut detail, tags and source line, and reduce the subtitle to the MCP URL. (BBC 4.3.6, ABCD "avoid competing elements")
7. **app 14.9-16.5 s, payoff card: FAIL.** Card 2 has 16 words for 1.6 s and needs 5.3 s. Card 1 has 13 words for 3.3 s and needs 4.3 s. The punch-in runs 14.25-14.95 s (0.7 s, power2.inOut), close to HEER07's "around 1 second", but card 2 fades in at 14.9 s while the zoom is still moving. Fix: cut card 2 to "67× the August median" (4 words, 1.3 s) and start it after the zoom settles at 14.95 s. The app UI shows the rest. (BBC, HEER07 staging, TSE) Live app timing passes, barely: the real app first appears at 10.5 s, against Google Play's "within the first 10 seconds", so any edit that adds time before the app scene breaks it. (GPLAY)
8. **chart 18.6-22.4 s, question and answer: FAIL.**
   - Question, fail: "Did fires in Greece triple in 2012?" has 7 words for 1.85 s including fades. Full opacity lasts only 1.5 s (18.8-20.3 s), and it needs 2.3 s.
   - Answer, pass: "No. The satellite changed." has 4 words for 1.95 s (needs 1.3 s).
   - Answer subline, fail: "VIIRS sees 3.5× more detections ..." has 11 words for 1.6 s and needs 3.7 s.
   - Fix: give the question 2.5 s and cut the subline to "VIIRS sees 3.5× more" (4 words). The question-to-answer swap at 20.3-20.45 s is a hard change within NFLX-TIM's rule (pass). (BBC, NFLX-TIM, JBM "shatter that expectation")
9. **chart 22.3-24.5 s, harmonized payoff: FAIL on staging and hold.**
    - Staging: between 22.3 and 22.9 s, five things change at once: the axis rescale (22.3-22.9 s), the jump fade, the MODIS greying (22.65 s), the harmonized line start (22.8 s) and a new 22-word caption (22.4 s). HEER07 says to stage the axis rescale apart from value changes, about 1 s per stage.
    - Hold: the finished harmonized line and band are complete at 24.0 s, and the chart fades at 24.28 s. The payoff shot holds 0.28 s.
    - Caption: 22 words for 2.08 s; it needs 7.3 s with the chart allowance.
    - Fix, in order: rescale 0.6 s, then grey MODIS, then draw the line about 1 s, then hold at least 1.5 s with a 7-word caption ("Harmonized: every year on the VIIRS scale"). Take the time from the MCP and numbers scenes. (HEER07, ROB08, BBC 4.3.4)
10. **numbers 24.5-27 s, evidence: FAIL.** 41 words in 2.5 s. The count-ups end at 25.3 s (5.4 %) and 25.55 s (86 %), so the final values hold only 1.53 s and 1.28 s before the fade at 26.83 s. BBC asks for extra time for long figures. Keep the two big numbers and one 5-word label each. Move the Argentina small print and the 13-word method line to the project page. Or show one number for the full 2.5 s. (BBC 4.3.6, RASKIN step 5)
11. **End card 27-30 s, close: FAIL on load, and on the ending idea.**
    - Load: 42 words, of which the 4-line meta block has 29 words visible for 2.45 s (needs 9.7 s).
    - Ending idea: S and DUARTE ask the last beat to show the future ("what it could be", "new bliss"), and ABCD and TIKTOK ask for one clear call to action. The tagline describes the product rather than the future.
    - Fix: one big URL as the call to action, one future line of 8 words or fewer, team name and members in small type. The MCP URL can move to the project page, or replace the tagline.
12. **Sound: open, measurable.** The v5 render has no audio track, and all four measured winners have one. If a bed goes in:
    - Loudness: integrated -20 to -16 LUFS, true peak at or below -1 dBTP, checked with `ffmpeg -af ebur128=peak=true` (AES1004). Not -23 (EBU, broadcast) and not a "-14 YouTube target", which Google does not publish (YT-LOUD).
    - Choice: one track for the whole film (APPLE-AP), quiet under the text (MAYER).
    - Licence: Pixabay without the shield icon, or the YouTube Audio Library standard licence if hosted on YouTube. Listed in References (J).
    - AI-generated music: needs the text and metadata acknowledgement (S).
