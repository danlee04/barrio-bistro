<?php

use App\Models\GalleryPhoto;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->admin = User::factory()->admin()->create();
});

/** A real JPEG, big enough to pass the dimension rule. */
function galleryPhoto(int $width = 1200, int $height = 900): UploadedFile
{
    $image = imagecreatetruecolor($width, $height);
    ob_start();
    imagejpeg($image);
    $jpeg = (string) ob_get_clean();

    return UploadedFile::fake()->createWithContent('room.jpg', $jpeg);
}

test('an admin adds a photo and the website can read it', function () {
    $this->actingAs($this->admin)
        ->post('/api/v1/admin/gallery', [
            'photo' => galleryPhoto(),
            'caption' => 'Sunday lunch',
        ])
        ->assertCreated()
        ->assertJsonPath('data.caption', 'Sunday lunch');

    $photo = GalleryPhoto::query()->sole();

    Storage::disk('public')->assertExists($photo->path.'-400.webp');
    Storage::disk('public')->assertExists($photo->path.'-800.webp');

    expect($photo->path)->toStartWith('gallery/');

    $this->getJson('/api/v1/gallery')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.caption', 'Sunday lunch')
        ->assertJsonPath('data.0.image.md', $photo->imageUrls()['md']);
});

test('the gallery keeps the order the shop arranged', function () {
    $first = GalleryPhoto::factory()->create(['sort_order' => 0, 'caption' => 'First']);
    $second = GalleryPhoto::factory()->create(['sort_order' => 1, 'caption' => 'Second']);

    $this->actingAs($this->admin)
        ->postJson("/api/v1/admin/gallery/{$second->id}/move", ['direction' => 'up'])
        ->assertNoContent();

    $this->getJson('/api/v1/gallery')
        ->assertOk()
        ->assertJsonPath('data.0.caption', 'Second')
        ->assertJsonPath('data.1.caption', 'First');

    expect($first->fresh()->sort_order)->toBe(1);
});

test('a caption can be rewritten or cleared', function () {
    $photo = GalleryPhoto::factory()->create(['caption' => 'Old words']);

    $this->actingAs($this->admin)
        ->patchJson("/api/v1/admin/gallery/{$photo->id}", ['caption' => 'New words'])
        ->assertOk()
        ->assertJsonPath('data.caption', 'New words');

    $this->actingAs($this->admin)
        ->patchJson("/api/v1/admin/gallery/{$photo->id}", ['caption' => null])
        ->assertOk()
        ->assertJsonPath('data.caption', null);
});

test('removing a photo takes its files with it', function () {
    $this->actingAs($this->admin)
        ->post('/api/v1/admin/gallery', ['photo' => galleryPhoto()])
        ->assertCreated();

    $photo = GalleryPhoto::query()->sole();

    $this->actingAs($this->admin)
        ->deleteJson("/api/v1/admin/gallery/{$photo->id}")
        ->assertNoContent();

    Storage::disk('public')->assertMissing($photo->path.'-400.webp');
    Storage::disk('public')->assertMissing($photo->path.'-800.webp');

    expect(GalleryPhoto::query()->count())->toBe(0);
});

test('only an admin may change the gallery', function () {
    $photo = GalleryPhoto::factory()->create();

    $this->postJson('/api/v1/admin/gallery')->assertUnauthorized();

    foreach (['cashier', 'kitchen'] as $role) {
        $staff = User::factory()->{$role}()->create();

        $this->actingAs($staff)->getJson('/api/v1/admin/gallery')->assertForbidden();
        $this->actingAs($staff)
            ->deleteJson("/api/v1/admin/gallery/{$photo->id}")
            ->assertForbidden();
    }

    expect(GalleryPhoto::query()->count())->toBe(1);
});

test('anything that is not a real photo is refused', function () {
    $this->actingAs($this->admin)
        ->post('/api/v1/admin/gallery', [
            'photo' => UploadedFile::fake()->createWithContent('shell.jpg', '<?php echo "hi";'),
        ])
        ->assertJsonValidationErrors(['photo']);

    $this->actingAs($this->admin)
        ->post('/api/v1/admin/gallery', ['photo' => galleryPhoto(400, 300)])
        ->assertJsonValidationErrors(['photo']);

    expect(GalleryPhoto::query()->count())->toBe(0);
});
