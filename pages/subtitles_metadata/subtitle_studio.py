import streamlit as st
from utilities.util_audio import (
    MODEL_MATRIX, STYLE_PRESETS, DEFAULT_PRESET,
    load_hf_token, save_hf_token,
    get_vram_recommendation, check_model_downloaded,
    is_video_file, save_upload_to_cache,
    extract_video_frame, extract_speaker_thumbnail, bgr_frame_to_rgb,
    run_transcription_pipeline, collect_raw_speaker_ids, apply_speaker_renames,
    get_system_fonts, render_subtitle_preview,
    export_txt, export_srt, export_ass_multistyle,
    extract_audio_snippet
)
from utilities.util_persistent import apply_footer

_defaults = {
    "segments":        [],
    "video_frame":     None,
    "temp_media_path": None,
    "file_ext":        None,
    "speaker_names":   {},
}
for _k, _v in _defaults.items():
    if _k not in st.session_state:
        st.session_state[_k] = _v

st.header("🎬 Subtitle Studio")
st.markdown(
    "Transcribe audio or video, identify speakers, style subtitles, and export ready-to-use files.")

tab_model, tab_transcribe, tab_speakers, tab_style, tab_export = st.tabs([
    "⚙️ Model Setup",
    "📂 Transcribe",
    "🧑‍🤝‍🧑 Speakers",
    "🎨 Subtitle Style",
    "⬇️ Export",
])

# ══════════════════════════════════════════════
#  TAB 1 – Model Setup
# ══════════════════════════════════════════════
with tab_model:
    st.markdown("### Transcription Model & Credentials")
    st.markdown(
        "Configure the Whisper model size and your Hugging Face token before transcribing.")

    col_model, col_token = st.columns(2, gap="large")

    with col_model:
        with st.container(border=True):
            st.markdown("#### 🤖 Whisper Model")
            rec_model, rec_msg = get_vram_recommendation()
            st.info(rec_msg)

            selected_model = st.selectbox(
                "Model size:",
                list(MODEL_MATRIX.keys()),
                index=list(MODEL_MATRIX.keys()).index(rec_model),
                key="selected_model",
            )

            meta = MODEL_MATRIX[selected_model]
            is_cached = check_model_downloaded(selected_model)

            with st.container(border=True):
                c1, c2 = st.columns(2)
                c1.metric("File Size",   meta["size"])
                c2.metric("VRAM Needed", meta["vram"])
                st.caption(
                    f"**Complexity:** {meta['complexity']}  •  {meta['desc']}")
                st.caption("✅ Cached locally" if is_cached
                           else "⚠️ Not cached — will download on first run")

    with col_token:
        with st.container(border=True):
            st.markdown("#### 🔑 Hugging Face Token")
            st.caption("Required only when speaker diarization is enabled.")

            hf_token = st.text_input(
                "Access token:",
                value=load_hf_token(),
                type="password",
                placeholder="hf_xxxxxxxxxxxxxxxxxxxx",
                key="hf_token",
            )
            if st.button("💾 Save Token", width="stretch"):
                if hf_token.strip():
                    save_hf_token(hf_token.strip())
                    st.success("Token saved to cache.")
                else:
                    st.warning("Enter a token before saving.")

            with st.expander("❓ How do I get a token?"):
                st.markdown("""
1. Go to [huggingface.co](https://huggingface.co) and sign in.
2. Profile picture → **Settings** → **Access Tokens**.
3. Create a token with **Read** permissions.
4. Paste it above and hit **Save Token**.
""")


# ══════════════════════════════════════════════
#  TAB 2 – Transcribe
# ══════════════════════════════════════════════
with tab_transcribe:
    st.markdown("### Upload & Transcribe")

    col_up, col_opts = st.columns(2, gap="large")

    with col_up:
        with st.container(border=True):
            st.markdown("#### :material/folder_open: Media File")
            uploaded_file = st.file_uploader(
                "Audio or video source",
                type=["mp3", "wav", "m4a", "mp4", "mkv", "avi", "mov"],
                label_visibility="collapsed",
            )

            if uploaded_file:
                temp_path = save_upload_to_cache(uploaded_file)

                # Only re-process when a genuinely new file arrives
                if st.session_state.temp_media_path != temp_path:
                    st.session_state.temp_media_path = temp_path
                    st.session_state.file_ext = uploaded_file.name.lower().rsplit(".",
                                                                                  1)[-1]
                    st.session_state.video_frame = (
                        extract_video_frame(temp_path)
                        if is_video_file(uploaded_file.name) else None
                    )
                    st.session_state.segments = []
                    st.session_state.speaker_names = {}

                st.success(f"Loaded: **{uploaded_file.name}**")
                if st.session_state.video_frame is not None:
                    st.image(bgr_frame_to_rgb(st.session_state.video_frame),
                             caption="Video preview frame", width="stretch")

    with col_opts:
        with st.container(border=True):
            st.markdown("#### 🎛️ Pipeline Options")

            do_diarize = st.checkbox(
                "Identify individual speakers",
                value=False,
                key="do_diarize",
                help="Uses pyannote diarization — requires a Hugging Face token.",
            )
            if do_diarize and not st.session_state.get("hf_token", "").strip():
                st.warning(
                    "⚠️ Set your Hugging Face token in **Model Setup** first.")

            st.divider()

            if st.button("▶️ Run Transcription", type="primary", width="stretch"):
                if not st.session_state.temp_media_path:
                    st.error("Upload a file first.")
                elif do_diarize and not st.session_state.get("hf_token", "").strip():
                    st.error(
                        "Diarization requires a Hugging Face token (see Model Setup tab).")
                else:
                    prog = st.progress(0)
                    status = st.empty()
                    try:
                        st.session_state.segments = run_transcription_pipeline(
                            st.session_state.temp_media_path,
                            st.session_state.get("selected_model", "base"),
                            st.session_state.get("hf_token", ""),
                            do_diarize,
                            {},   # raw IDs; user renames in Speakers tab
                            prog, status,
                        )
                        # Seed speaker name map with raw IDs
                        for sid in collect_raw_speaker_ids(st.session_state.segments):
                            st.session_state.speaker_names.setdefault(sid, sid)

                        st.success(
                            f"✅ Done — {len(st.session_state.segments)} segments transcribed."
                        )
                    except Exception as e:
                        st.error(f"Pipeline error: {e}")

    # Raw transcript preview (collapsed)
    if st.session_state.segments:
        with st.expander("📝 Raw transcript preview", expanded=False):
            lines = []
            for seg in st.session_state.segments[:30]:
                spk = seg.get("speaker", "")
                prefix = f"**[{spk}]** " if spk else ""
                lines.append(f"{prefix}{seg['text'].strip()}")
            st.markdown("\n\n".join(lines))
            if len(st.session_state.segments) > 30:
                st.caption(
                    f"… and {len(st.session_state.segments) - 30} more segments.")

# ══════════════════════════════════════════════
#  TAB 3 – Speakers (Modified with Audio Preview)
# ══════════════════════════════════════════════
with tab_speakers:
    st.markdown("### Speaker Identification & Renaming")

    if not st.session_state.segments:
        st.info("Run the transcription pipeline first (Transcribe tab).")
    else:
        raw_ids = collect_raw_speaker_ids(st.session_state.segments)
        is_video = st.session_state.video_frame is not None

        all_unknown = all(sid == "UNKNOWN" for sid in raw_ids)
        if all_unknown:
            st.info(
                "Speaker diarization was not enabled — all speech is a single track.")
            st.markdown(
                "Enable **Identify individual speakers** in the Transcribe tab and re-run "
                "to get per-speaker labelling."
            )
        else:
            st.markdown(
                f"**{len(raw_ids)} speaker(s) detected.** Rename them below.")
            st.divider()

            for sid in raw_ids:
                spk_segs = [
                    s for s in st.session_state.segments if s.get("speaker") == sid]

                with st.container(border=True):
                    # Changed layout to accommodate audio player
                    col_thumb, col_info, col_audio = st.columns(
                        [1, 2, 1], vertical_alignment="center")

                    with col_thumb:
                        thumb = None
                        if is_video and spk_segs:
                            thumb = extract_speaker_thumbnail(
                                st.session_state.temp_media_path,
                                spk_segs[0]["start"],
                            )
                        if thumb is not None:
                            st.image(
                                thumb, caption="First appearance", width="stretch")
                        else:
                            st.markdown(
                                "<div style='background:#1e1e2e;border-radius:8px;"
                                "padding:32px;text-align:center;font-size:2.5rem;'>🎙️</div>",
                                unsafe_allow_html=True,
                            )

                    with col_info:
                        new_name = st.text_input(
                            f"Rename `{sid}`",
                            value=st.session_state.speaker_names.get(sid, sid),
                            key=f"spk_rename_{sid}",
                        )
                        st.session_state.speaker_names[sid] = new_name.strip(
                        ) or sid

                        snippet = " ".join(s["text"].strip()
                                           for s in spk_segs[:3])
                        if len(snippet) > 220:
                            snippet = snippet[:220] + "…"
                        st.caption(f"🗣️ *{snippet}*")
                        st.caption(f"Segments: **{len(spk_segs)}**")

                    with col_audio:
                        # Extract and play audio snippet for the first segment
                        if spk_segs:
                            start_time = spk_segs[0]["start"]
                            end_time = spk_segs[0]["end"]

                            if st.button("🎤 Hear Voice", key=f"hear_{sid}", width="stretch"):
                                with st.spinner("Extracting audio..."):
                                    audio_bytes = extract_audio_snippet(
                                        st.session_state.temp_media_path, start_time, end_time)
                                    if audio_bytes:
                                        st.audio(
                                            audio_bytes, format="audio/wav")
                                    else:
                                        st.error("Could not extract audio.")

            st.divider()
            if st.button("✅ Apply Names to Transcript", type="primary", width="stretch"):
                mapping = st.session_state.speaker_names
                st.session_state.segments = apply_speaker_renames(
                    st.session_state.segments, mapping
                )
                st.session_state.speaker_names = {
                    mapping.get(k, k): mapping.get(k, k) for k in raw_ids
                }
                st.success(
                    "Names applied! Head to **Subtitle Style** to preview.")

# ══════════════════════════════════════════════
#  TAB 4 – Subtitle Style
# ══════════════════════════════════════════════
with tab_style:
    st.markdown("### Subtitle Style Editor")

    if not st.session_state.segments:
        st.info("Complete transcription first (Transcribe tab).")
    else:
        fmt = st.radio(
            "Target export format:",
            [".txt / .srt  (dialogue text)",
             ".ass  (Advanced SubStation Alpha)"],
            horizontal=True,
            key="style_fmt",
        )
        st.divider()

        # ── Plain / SRT preview ───────────────────────────────────────
        if fmt.startswith(".txt"):
            st.markdown("#### Plain / SubRip Dialogue Preview")
            st.caption("Subtitles appear as  **Speaker: Text**  lines.")

            with st.container(border=True):
                c1, c2, c3 = st.columns(3)
                show_names = c1.checkbox(
                    "Show speaker names",  value=True,  key="srt_show_names")
                separator = c2.selectbox("Separator",          [
                                         ":", " →", " |"], key="srt_sep")
                uppercase_names = c3.checkbox(
                    "UPPERCASE names",     value=False, key="srt_upper")

            st.markdown("#### 👁️ Preview")
            with st.container(border=True):
                for seg in st.session_state.segments[:6]:
                    text = seg["text"].strip()
                    spk = seg.get("speaker", "")
                    if show_names and spk:
                        name = spk.upper() if uppercase_names else spk
                        st.markdown(f"**{name}{separator}** {text}")
                    else:
                        st.markdown(text)

        # ── ASS per-speaker style editor ─────────────────────────────
        else:
            font_options = get_system_fonts()
            speakers = sorted({seg.get("speaker", "UNKNOWN")
                              for seg in st.session_state.segments})
            multi_speaker = len(speakers) > 1

            # Preset bar
            col_pre, col_apply = st.columns(
                [3, 1], vertical_alignment="bottom")
            chosen_preset = col_pre.selectbox(
                "Style preset:",
                list(STYLE_PRESETS.keys()),
                key="ass_preset",
            )
            apply_preset = col_apply.button("⚡ Apply Preset", width="stretch")

            preset_vals = STYLE_PRESETS.get(
                chosen_preset) or STYLE_PRESETS[DEFAULT_PRESET]

            # Initialise per-speaker style state
            if "ass_styles" not in st.session_state or apply_preset:
                st.session_state.ass_styles = {
                    spk: dict(preset_vals) for spk in speakers}

            st.divider()

            # ── Inline style editor helper (pure UI, no logic) ───────
            def _style_editor(key_prefix: str, style_dict: dict) -> dict:
                c1, c2 = st.columns(2)
                with c1:
                    style_dict["font"] = st.selectbox(
                        "Font family", font_options,
                        index=font_options.index(
                            style_dict.get("font", "Arial"))
                        if style_dict.get("font", "Arial") in font_options else 0,
                        key=f"{key_prefix}_font",
                    )
                    style_dict["size"] = st.slider("Font size",       18, 120, style_dict.get(
                        "size", 52),     key=f"{key_prefix}_size")
                    style_dict["margin_v"] = st.slider("Bottom margin",    5, 400, style_dict.get(
                        "margin_v", 60), key=f"{key_prefix}_mv")
                with c2:
                    style_dict["primary_color"] = st.color_picker("Text color",    style_dict.get(
                        "primary_color", "#FFFFFF"), key=f"{key_prefix}_pc")
                    style_dict["primary_trans"] = st.slider("Text opacity", 0.0, 1.0, style_dict.get(
                        "primary_trans", 1.0), step=0.05, key=f"{key_prefix}_pt")
                    style_dict["outline_color"] = st.color_picker("Outline color", style_dict.get(
                        "outline_color", "#000000"), key=f"{key_prefix}_oc")
                    style_dict["outline_width"] = st.slider("Outline width", 0, 10, style_dict.get(
                        "outline_width", 3), key=f"{key_prefix}_ow")
                return style_dict

            # Per-speaker sub-tabs
            if multi_speaker:
                spk_tabs = st.tabs(
                    [f"🎙️ {spk}" for spk in speakers] + ["🌐 Global Defaults"])
                for i, spk in enumerate(speakers):
                    with spk_tabs[i]:
                        st.markdown(f"#### Style for **{spk}**")
                        st.session_state.ass_styles[spk] = _style_editor(
                            f"ass_{spk}", st.session_state.ass_styles[spk]
                        )
                with spk_tabs[-1]:
                    st.markdown("#### Apply one style to all speakers at once")
                    global_style = _style_editor(
                        "ass_global", dict(STYLE_PRESETS[DEFAULT_PRESET]))
                    if st.button("📋 Copy to All Speakers", width="stretch"):
                        for spk in speakers:
                            st.session_state.ass_styles[spk] = dict(
                                global_style)
                        st.success("Global style applied to all speakers.")
            else:
                spk = speakers[0] if speakers else "UNKNOWN"
                st.session_state.ass_styles = st.session_state.get(
                    "ass_styles", {spk: dict(preset_vals)})
                st.session_state.ass_styles[spk] = _style_editor(
                    f"ass_{spk}", st.session_state.ass_styles.get(
                        spk, dict(preset_vals))
                )

            # Canvas preview
            st.divider()
            st.markdown("#### 👁️ Canvas Preview")

            preview_spk = (
                st.selectbox("Preview speaker:", speakers,
                             key="ass_preview_spk")
                if multi_speaker else speakers[0]
            )
            prev_style = st.session_state.ass_styles.get(preview_spk, {})
            sample_txt = (
                f"{preview_spk}: Hello world! This is a subtitle preview."
                if multi_speaker else "Hello world! This is a subtitle preview."
            )
            preview_rgb = render_subtitle_preview(
                st.session_state.video_frame, sample_txt, prev_style
            )
            st.image(preview_rgb, width="stretch")


# ══════════════════════════════════════════════
#  TAB 5 – Export
# ══════════════════════════════════════════════
with tab_export:
    st.markdown("### Export Subtitles")

    if not st.session_state.segments:
        st.info("Run the transcription pipeline first (Transcribe tab).")
    else:
        identify = st.session_state.get("do_diarize", False)
        st.success(
            f"Ready to export **{len(st.session_state.segments)} segments**.")
        st.divider()

        col_txt, col_srt, col_ass = st.columns(3, gap="large")

        # ── .TXT ─────────────────────────────────────────────────────
        with col_txt:
            with st.container(border=True):
                st.markdown("#### 📄 Plain Text")
                st.caption(
                    "Clean transcript. Speaker names prepended as dialogue labels when diarization was used.")

                txt_data = export_txt(
                    st.session_state.segments,
                    identify_people=identify,
                    show_names=st.session_state.get("srt_show_names", True),
                    separator=st.session_state.get("srt_sep", ":"),
                    uppercase_names=st.session_state.get("srt_upper", False),
                )
                st.download_button(
                    "⬇️ Download .TXT",
                    data=txt_data, file_name="transcript.txt", mime="text/plain",
                    type="primary", width="stretch",
                )

        # ── .SRT ─────────────────────────────────────────────────────
        with col_srt:
            with st.container(border=True):
                st.markdown("#### 🎞️ SubRip (.SRT)")
                st.caption(
                    "Timed subtitles compatible with most players and editors.")

                srt_data = export_srt(st.session_state.segments, identify)
                st.download_button(
                    "⬇️ Download .SRT",
                    data=srt_data, file_name="transcript.srt", mime="text/plain",
                    type="primary", width="stretch",
                )

        # ── .ASS ─────────────────────────────────────────────────────
        with col_ass:
            with st.container(border=True):
                st.markdown("#### 🎨 Advanced SubStation Alpha (.ASS)")
                st.caption(
                    "Fully styled subtitles with per-speaker formatting from the Style tab.")

                speakers = sorted({seg.get("speaker", "UNKNOWN")
                                  for seg in st.session_state.segments})
                ass_styles = st.session_state.get("ass_styles") or {
                    spk: dict(STYLE_PRESETS[DEFAULT_PRESET]) for spk in speakers
                }

                ass_data = export_ass_multistyle(
                    st.session_state.segments, ass_styles, identify
                )
                st.download_button(
                    "⬇️ Download .ASS",
                    data=ass_data, file_name="transcript.ass", mime="text/plain",
                    type="primary", width="stretch",
                )

        st.divider()
        st.caption(
            "💡 **Tip:** Use .ASS in mpv, VLC, or Aegisub for full styled subtitle support. "
            ".SRT works universally. .TXT is ideal for reading or feeding into other tools."
        )

apply_footer()
