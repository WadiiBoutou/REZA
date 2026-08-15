import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

import '../constants.dart';

/// Avatar picking flow used everywhere a profile photo is chosen:
/// 1. Bottom sheet asks Galerie / Appareil photo.
/// 2. The matching OS permission is requested first.
/// 3. Returns the picked image (null if cancelled or permission denied).
Future<XFile?> pickAvatarImage(BuildContext context) async {
  final showCamera = !kIsWeb; // camera capture is not supported on web
  final source = await showModalBottomSheet<ImageSource>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Photo de profil',
              style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textDark),
            ),
            const SizedBox(height: 4),
            Text(
              'Choisissez une source',
              style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray),
            ),
            const SizedBox(height: 14),
            _SourceTile(
              icon: Icons.photo_library_outlined,
              label: 'Choisir depuis la galerie',
              value: ImageSource.gallery,
            ),
            if (showCamera) ...[
              const SizedBox(height: 8),
              _SourceTile(
                icon: Icons.photo_camera_outlined,
                label: 'Prendre une photo',
                value: ImageSource.camera,
              ),
            ],
          ],
        ),
      ),
    ),
  );
  if (source == null) return null;

  if (!kIsWeb) {
    final granted = await _requestSourcePermission(source, context);
    if (!granted) return null;
  }

  try {
    return await ImagePicker().pickImage(
      source: source,
      maxWidth: 800,
      maxHeight: 800,
      imageQuality: 85,
    );
  } catch (_) {
    return null;
  }
}

/// Requests the OS permission matching the chosen source. On Android the photo
/// picker itself needs no runtime permission, but this still gives the explicit
/// OS ask on Android 13+ / iOS as requested.
Future<bool> _requestSourcePermission(ImageSource source, BuildContext context) async {
  final Permission permission;
  if (Platform.isIOS) {
    permission = source == ImageSource.gallery ? Permission.photos : Permission.camera;
  } else {
    // Android: PHOTOS maps to READ_MEDIA_IMAGES on 13+ (no-op below), CAMERA
    // is a real runtime permission on every version.
    permission = source == ImageSource.gallery ? Permission.photos : Permission.camera;
  }

  var status = await permission.status;
  if (status.isGranted) return true;
  if (status.isPermanentlyDenied) {
    _showSettingsDialog(context);
    return false;
  }
  status = await permission.request();
  if (status.isGranted) return true;
  if (status.isPermanentlyDenied && context.mounted) {
    _showSettingsDialog(context);
  }
  return false;
}

void _showSettingsDialog(BuildContext context) {
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(
        'Autorisation requise',
        style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textDark),
      ),
      content: Text(
        "L'accès a été refusé. Vous pouvez l'autoriser depuis les paramètres de l'application.",
        style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: Text('Annuler', style: GoogleFonts.inter(color: AppColors.textGray, fontWeight: FontWeight.w600)),
        ),
        TextButton(
          onPressed: () {
            Navigator.pop(ctx);
            openAppSettings();
          },
          child: Text('Paramètres', style: GoogleFonts.inter(color: AppColors.textDark, fontWeight: FontWeight.w700)),
        ),
      ],
    ),
  );
}

class _SourceTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final ImageSource value;

  const _SourceTile({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.pop(context, value),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Icon(icon, size: 22, color: AppColors.textDark),
            const SizedBox(width: 12),
            Text(label, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textDark)),
          ],
        ),
      ),
    );
  }
}
