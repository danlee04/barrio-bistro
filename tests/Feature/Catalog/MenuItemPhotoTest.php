<?php

use App\Models\MenuItem;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->admin = User::factory()->admin()->create();
    $this->item = MenuItem::factory()->create();
});

/**
 * A real JPEG with an EXIF (APP1) segment carrying a marker string, like a phone photo's GPS data.
 */
function jpegWithExifMarker(string $marker, int $width = 1200, int $height = 900): UploadedFile
{
    $image = imagecreatetruecolor($width, $height);
    ob_start();
    imagejpeg($image);
    $jpeg = (string) ob_get_clean();

    $payload = "Exif\0\0".$marker;
    $segment = "\xFF\xE1".pack('n', strlen($payload) + 2).$payload;

    return UploadedFile::fake()->createWithContent('phone.jpg', substr($jpeg, 0, 2).$segment.substr($jpeg, 2));
}

test('an uploaded photo becomes two square webp renditions without its exif data', function () {
    $response = $this->actingAs($this->admin)
        ->postJson("/api/v1/admin/menu-items/{$this->item->id}/photo", ['photo' => jpegWithExifMarker('GPS-SECRET-14.5995N')])
        ->assertOk();

    $path = $this->item->fresh()->image_path;

    foreach ([400, 800] as $edge) {
        $file = "{$path}-{$edge}.webp";
        Storage::disk('public')->assertExists($file);

        $contents = (string) Storage::disk('public')->get($file);
        $info = getimagesizefromstring($contents);

        expect([$info[0], $info[1], $info['mime']])->toBe([$edge, $edge, 'image/webp'])
            ->and($contents)->not->toContain('GPS-SECRET');
    }

    $response->assertJsonPath('data.image.md', "/storage/{$path}-800.webp");
    $this->assertDatabaseHas('audit_logs', ['action' => 'menu_item.photo_changed', 'subject_id' => $this->item->id]);
});

test('replacing a photo deletes the old files', function () {
    $this->actingAs($this->admin)->postJson("/api/v1/admin/menu-items/{$this->item->id}/photo", [
        'photo' => UploadedFile::fake()->image('first.jpg', 1000, 1000),
    ])->assertOk();
    $oldPath = $this->item->fresh()->image_path;

    $this->actingAs($this->admin)->postJson("/api/v1/admin/menu-items/{$this->item->id}/photo", [
        'photo' => UploadedFile::fake()->image('second.png', 1000, 1000),
    ])->assertOk();

    Storage::disk('public')->assertMissing("{$oldPath}-400.webp");
    Storage::disk('public')->assertMissing("{$oldPath}-800.webp");
});

test('removing a photo deletes the files and clears the item', function () {
    $this->actingAs($this->admin)->postJson("/api/v1/admin/menu-items/{$this->item->id}/photo", [
        'photo' => UploadedFile::fake()->image('dish.jpg', 1000, 1000),
    ]);
    $path = $this->item->fresh()->image_path;

    $this->actingAs($this->admin)
        ->deleteJson("/api/v1/admin/menu-items/{$this->item->id}/photo")
        ->assertOk()
        ->assertJsonPath('data.image', null);

    Storage::disk('public')->assertMissing("{$path}-800.webp");
});

test('dangerous or unsuitable files are rejected before processing', function (Closure $makeFile) {
    $this->actingAs($this->admin)
        ->postJson("/api/v1/admin/menu-items/{$this->item->id}/photo", ['photo' => $makeFile()])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('photo');

    expect(Storage::disk('public')->allFiles())->toBeEmpty();
})->with([
    'php disguised as jpg' => fn () => UploadedFile::fake()->createWithContent('shell.jpg', '<?php system($_GET["c"]); ?>'),
    'gif' => fn () => UploadedFile::fake()->image('dish.gif', 1000, 1000),
    'too small' => fn () => UploadedFile::fake()->image('dish.jpg', 400, 400),
    'too large in pixels' => fn () => UploadedFile::fake()->image('dish.jpg', 5000, 800),
    'over 5 MB' => fn () => UploadedFile::fake()->create('dish.jpg', 6000, 'image/jpeg'),
]);

test('only admins change photos', function (string $role) {
    $this->actingAs(User::factory()->{$role}()->create())
        ->postJson("/api/v1/admin/menu-items/{$this->item->id}/photo", ['photo' => UploadedFile::fake()->image('dish.jpg', 1000, 1000)])
        ->assertForbidden();
})->with(['cashier', 'kitchen']);
