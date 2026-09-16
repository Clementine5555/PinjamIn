import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class ProductCard extends StatelessWidget {
  const ProductCard({
    required this.title,
    required this.price,
    required this.imageUrl,
    this.onTap,
    this.badge = 'Tersedia',
    super.key,
  });

  final String title;
  final String price;
  final String imageUrl;
  final String badge;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                AspectRatio(
                  aspectRatio: 4 / 3,
                  child: Image.network(imageUrl, fit: BoxFit.cover),
                ),
                Positioned(
                  left: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.mint,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      badge,
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                const Positioned(
                  right: 8,
                  top: 8,
                  child: CircleAvatar(
                    radius: 16,
                    backgroundColor: Colors.white,
                    child: Icon(Icons.favorite_border, size: 18),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    '★ 4.9 · <500m',
                    style: TextStyle(color: AppColors.muted, fontSize: 11),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    price,
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
